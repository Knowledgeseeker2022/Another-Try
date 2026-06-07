/**
 * BullMQ sync worker — run as a separate process alongside Next.js:
 *   npm run worker
 *
 * Picks up jobs from the "service-sync" queue, runs the appropriate connector,
 * and writes results back to the database.
 */
import { Worker, type Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { makeBullConnection as makeBullConnectionOptions, type SyncJobData } from "../lib/queue";
import { decryptConfig, encryptionAvailable } from "../lib/crypto";
import { M365Connector } from "../connectors/m365";
import { HaloPSAConnector } from "../connectors/halopsa";
import { TodylConnector } from "../connectors/todyl";
import type { Connector } from "../connectors/base";

const db = new PrismaClient();

const CONNECTORS: Connector[] = [
  new M365Connector(),
  new HaloPSAConnector(),
  new TodylConnector(),
];

const connectorMap = new Map<string, Connector>(
  CONNECTORS.map((c) => [c.slug, c])
);

async function processSync(job: Job<SyncJobData>): Promise<void> {
  const { serviceSlug, triggeredBy } = job.data;
  console.log(`[worker] Starting sync for ${serviceSlug} (job ${job.id})`);

  const service = await db.service.findUnique({ where: { slug: serviceSlug } });
  if (!service) throw new Error(`Service "${serviceSlug}" not found.`);
  if (!service.config) throw new Error(`No credentials configured for "${serviceSlug}".`);

  const connector = connectorMap.get(serviceSlug);
  if (!connector) throw new Error(`No connector implemented for "${serviceSlug}".`);

  // Decrypt config
  let config: Record<string, string>;
  const rawConfig = service.config as unknown;

  if (typeof rawConfig === "string" && encryptionAvailable()) {
    config = decryptConfig(rawConfig) as Record<string, string>;
  } else if (typeof rawConfig === "object" && rawConfig !== null) {
    // Stored as plain JSON (no ENCRYPTION_KEY set) — use directly
    config = rawConfig as Record<string, string>;
  } else {
    throw new Error("Could not read service credentials.");
  }

  // Create sync log entry
  const log = await db.serviceSyncLog.create({
    data: { serviceId: service.id, status: "running", recordsIn: 0, recordsOut: 0 },
  });

  const started = Date.now();

  try {
    const result = await connector.sync(config, db);

    const durationMs = Date.now() - started;

    await db.serviceSyncLog.update({
      where: { id: log.id },
      data: {
        status: "success",
        recordsIn: result.recordsIn,
        recordsOut: result.recordsOut,
        durationMs,
        completedAt: new Date(),
      },
    });

    await db.service.update({
      where: { slug: serviceSlug },
      data: { status: "CONNECTED", lastSyncAt: new Date(), errorMessage: null },
    });

    await db.auditLog.create({
      data: {
        action: "service.sync.completed",
        resource: "Service",
        resourceId: serviceSlug,
        userId: triggeredBy ?? null,
        metadata: { recordsIn: result.recordsIn, recordsOut: result.recordsOut, durationMs },
      },
    });

    console.log(
      `[worker] ${serviceSlug} synced — ${result.recordsIn} in, ${result.recordsOut} out (${durationMs}ms)`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - started;

    await db.serviceSyncLog.update({
      where: { id: log.id },
      data: { status: "error", error: message, durationMs, completedAt: new Date() },
    });

    await db.service.update({
      where: { slug: serviceSlug },
      data: { status: "ERROR", errorMessage: message },
    });

    await db.auditLog.create({
      data: {
        action: "service.sync.failed",
        resource: "Service",
        resourceId: serviceSlug,
        userId: triggeredBy ?? null,
        metadata: { error: message },
      },
    });

    console.error(`[worker] ${serviceSlug} sync failed: ${message}`);
    throw err; // re-throw so BullMQ can retry
  }
}

const worker = new Worker<SyncJobData>("service-sync", processSync, {
  connection: makeBullConnectionOptions(),
  concurrency: 3,
});

worker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} completed.`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] Job ${job?.id} failed: ${err.message}`);
});

worker.on("error", (err) => {
  console.error("[worker] Worker error:", err);
});

console.log("[worker] Sync worker started. Waiting for jobs...");

// Graceful shutdown
async function shutdown() {
  console.log("[worker] Shutting down...");
  await worker.close();
  await db.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

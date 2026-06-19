/**
 * BullMQ sync worker — run as a separate process alongside Next.js:
 *   npm run worker
 *
 * Picks up jobs from the "service-sync" queue, runs the appropriate connector,
 * and writes results back to the database.
 */
import { Worker, Queue, type Job } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { makeBullConnection as makeBullConnectionOptions, type SyncJobData } from "../lib/queue";
import { decryptConfig } from "../lib/crypto";
import { M365Connector } from "../connectors/m365";
import { HaloPSAConnector } from "../connectors/halopsa";
import { TodylConnector } from "../connectors/todyl";
import type { Connector } from "../connectors/base";

const db = new PrismaClient();
const redis = new IORedis(makeBullConnectionOptions());
const queue = new Queue<SyncJobData>("service-sync", { connection: makeBullConnectionOptions() });

const CONNECTORS: Connector[] = [
  new M365Connector(),
  new HaloPSAConnector(),
  new TodylConnector(),
];

const connectorMap = new Map<string, Connector>(
  CONNECTORS.map((c) => [c.slug, c])
);

// Single lock mechanism: Redis SET NX with TTL.
// If a sync for slug is already in flight, the new job skips immediately.
const LOCK_TTL_SECONDS = 600; // 10-minute cap covers the slowest realistic full pull
const ESCALATION_THRESHOLD = 3;

async function acquireLock(slug: string): Promise<boolean> {
  // ioredis v5: EX before NX in positional arguments
  const result = await redis.set(`lock:sync:${slug}`, "1", "EX", LOCK_TTL_SECONDS, "NX");
  return result === "OK";
}

async function releaseLock(slug: string): Promise<void> {
  await redis.del(`lock:sync:${slug}`);
}

async function processSync(job: Job<SyncJobData>): Promise<void> {
  const { serviceSlug, triggeredBy } = job.data;
  const isScheduled = triggeredBy === "scheduler";

  // Concurrency guard: one sync per service slug at a time.
  // Overlapping run is skipped-and-logged, never queued or double-run.
  const locked = await acquireLock(serviceSlug);
  if (!locked) {
    console.log(`[worker] Skipping ${serviceSlug}: sync already in flight (job ${job.id})`);
    await db.auditLog.create({
      data: {
        action: "service.sync.skipped",
        resource: "Service",
        resourceId: serviceSlug,
        userId: null,
        metadata: { reason: "sync_in_flight", jobId: job.id },
      },
    });
    return;
  }

  console.log(`[worker] Starting sync: ${serviceSlug} (job ${job.id}, by: ${triggeredBy ?? "unknown"})`);

  try {
    const service = await db.service.findUnique({ where: { slug: serviceSlug } });
    if (!service) throw new Error(`Service "${serviceSlug}" not found.`);
    if (!service.config) throw new Error(`No credentials configured for "${serviceSlug}".`);
    if (service.status === "DISABLED") throw new Error(`Service "${serviceSlug}" is disabled.`);

    const connector = connectorMap.get(serviceSlug);
    if (!connector) throw new Error(`No connector implemented for "${serviceSlug}".`);

    // Plaintext fallback removed. If config is not an encrypted string, fail hard.
    // This prevents any code path from using credentials stored without ENCRYPTION_KEY.
    const rawConfig = service.config as unknown;
    if (typeof rawConfig !== "string") {
      throw new Error(
        `Service "${serviceSlug}" config is not encrypted. ` +
        `Set ENCRYPTION_KEY and re-enter credentials.`
      );
    }
    const config = decryptConfig(rawConfig) as Record<string, string>;

    // Watermark: capture time before any API calls; pass 5-min-earlier window to allow
    // overlap. lastSyncAt advances only on full success — never on partial or failed run.
    const syncStartedAt = new Date();
    const effectiveFrom = service.lastSyncAt
      ? new Date(service.lastSyncAt.getTime() - 5 * 60 * 1000)
      : undefined;

    const log = await db.serviceSyncLog.create({
      data: {
        serviceId: service.id,
        status: "running",
        recordsIn: 0,
        recordsOut: 0,
        triggeredBy: triggeredBy ?? null,
      },
    });

    const started = Date.now();

    try {
      const result = await connector.sync(config, db, effectiveFrom);
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

      const nextSyncAt = service.pollInterval
        ? new Date(syncStartedAt.getTime() + service.pollInterval * 1000)
        : null;

      await db.service.update({
        where: { slug: serviceSlug },
        data: {
          status: "CONNECTED",
          lastSyncAt: syncStartedAt, // watermark advances to sync-start time, not wall-clock end
          ...(nextSyncAt ? { nextSyncAt } : {}),
          errorMessage: null,
          consecutiveFailures: 0,
        },
      });

      await db.auditLog.create({
        data: {
          action: "service.sync.completed",
          resource: "Service",
          resourceId: serviceSlug,
          userId: isScheduled ? null : (triggeredBy ?? null),
          metadata: {
            recordsIn: result.recordsIn,
            recordsOut: result.recordsOut,
            durationMs,
            triggeredBy: triggeredBy ?? "scheduler",
          },
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

      // lastSyncAt deliberately NOT updated — watermark stays at last successful sync.
      // Records modified since lastSyncAt will be re-fetched on the next successful run.
      const updated = await db.service.update({
        where: { slug: serviceSlug },
        data: {
          status: "ERROR",
          errorMessage: message,
          consecutiveFailures: { increment: 1 },
        },
        select: { consecutiveFailures: true },
      });

      await db.auditLog.create({
        data: {
          action: "service.sync.failed",
          resource: "Service",
          resourceId: serviceSlug,
          userId: isScheduled ? null : (triggeredBy ?? null),
          metadata: { error: message, consecutiveFailures: updated.consecutiveFailures },
        },
      });

      // Escalate when consecutive failures hit threshold: louder audit event + stderr
      if (updated.consecutiveFailures >= ESCALATION_THRESHOLD) {
        await db.auditLog.create({
          data: {
            action: "service.sync.escalated",
            resource: "Service",
            resourceId: serviceSlug,
            userId: null,
            metadata: {
              consecutiveFailures: updated.consecutiveFailures,
              lastError: message,
            },
          },
        });
        console.error(
          `[worker] ESCALATED: ${serviceSlug} — ${updated.consecutiveFailures} consecutive failures. Manual intervention required.`
        );
      }

      console.error(`[worker] ${serviceSlug} sync failed: ${message}`);

      // Scheduled jobs swallow the error — the repeatable scheduler re-fires at next interval.
      // Manual triggers re-throw so BullMQ can retry with exponential backoff.
      if (!isScheduled) throw err;
    }
  } finally {
    await releaseLock(serviceSlug);
  }
}

// Register a repeatable scheduler for every CONNECTED POLLING service at startup.
// upsertJobScheduler is idempotent — safe to call on every worker restart.
async function initSchedulers(): Promise<void> {
  const services = await db.service.findMany({
    where: { status: "CONNECTED", syncMode: "POLLING" },
    select: { slug: true, pollInterval: true },
  });

  for (const svc of services) {
    const pollMs = (svc.pollInterval ?? 3600) * 1000;
    await queue.upsertJobScheduler(
      `repeat:${svc.slug}`,
      { every: pollMs },
      {
        name: `sync:${svc.slug}`,
        data: { serviceSlug: svc.slug, triggeredBy: "scheduler" },
        opts: { attempts: 1, removeOnComplete: { count: 50 }, removeOnFail: { count: 50 } },
      },
    );
    console.log(`[worker] Scheduler registered: ${svc.slug} every ${pollMs / 60_000}m`);
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

initSchedulers()
  .then(() => console.log("[worker] Sync worker started. Waiting for jobs…"))
  .catch((err) => console.error("[worker] Failed to initialize schedulers:", err));

async function shutdown() {
  console.log("[worker] Shutting down…");
  await worker.close();
  await redis.quit();
  await db.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

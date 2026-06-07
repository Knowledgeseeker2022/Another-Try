import { Queue } from "bullmq";

// BullMQ v5 bundles its own ioredis — pass plain connection options to avoid
// a type mismatch between the two ioredis versions.
function makeBullConnectionOptions() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
    maxRetriesPerRequest: null as null,
    enableReadyCheck: false,
  };
}

export interface SyncJobData {
  serviceSlug: string;
  triggeredBy?: string;
}

const globalForQueue = globalThis as unknown as { syncQueue: Queue<SyncJobData> | undefined };

function createQueue() {
  return new Queue<SyncJobData>("service-sync", {
    connection: makeBullConnectionOptions(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });
}

export const syncQueue: Queue<SyncJobData> =
  globalForQueue.syncQueue ?? createQueue();

if (process.env.NODE_ENV !== "production") globalForQueue.syncQueue = syncQueue;

export async function queueSync(slug: string, userId?: string): Promise<string> {
  const job = await syncQueue.add(
    `sync:${slug}`,
    { serviceSlug: slug, triggeredBy: userId },
    { jobId: `sync:${slug}:${Date.now()}` }
  );
  return job.id ?? "queued";
}

export { makeBullConnectionOptions as makeBullConnection };

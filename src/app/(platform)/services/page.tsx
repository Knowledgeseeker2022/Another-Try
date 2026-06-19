import { db } from "@/lib/db";
import { ServicesClient } from "./services-client";

export default async function ServicesPage() {
  const services = await db.service.findMany({
    include: {
      _count: { select: { syncLogs: true } },
      syncLogs: { take: 1, orderBy: { startedAt: "desc" } },
    },
    orderBy: { name: "asc" },
  });

  const mapped = services.map(({ config, syncLogs, ...s }) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    category: s.category,
    status: s.status as "CONNECTED" | "DISCONNECTED" | "ERROR" | "PENDING" | "DISABLED",
    syncMode: s.syncMode as "POLLING" | "WEBHOOK",
    lastSyncAt: s.lastSyncAt?.toISOString() ?? null,
    nextSyncAt: s.nextSyncAt?.toISOString() ?? null,
    pollInterval: s.pollInterval,
    consecutiveFailures: s.consecutiveFailures,
    errorMessage: s.errorMessage,
    hasCredentials: !!config,
    latestLog: syncLogs[0]
      ? {
          ...syncLogs[0],
          startedAt: syncLogs[0].startedAt.toISOString(),
          completedAt: syncLogs[0].completedAt?.toISOString() ?? null,
        }
      : null,
    _count: s._count,
  }));

  return <ServicesClient initial={mapped} />;
}

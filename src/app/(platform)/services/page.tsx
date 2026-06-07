import { db } from "@/lib/db";
import { ServicesClient } from "./services-client";

export default async function ServicesPage() {
  const services = await db.service.findMany({
    include: { _count: { select: { syncLogs: true } } },
    orderBy: { name: "asc" },
  });

  const mapped = services.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    category: s.category,
    status: s.status as "CONNECTED" | "DISCONNECTED" | "ERROR" | "PENDING" | "DISABLED",
    syncMode: s.syncMode as "POLLING" | "WEBHOOK",
    lastSyncAt: s.lastSyncAt?.toISOString() ?? null,
    nextSyncAt: s.nextSyncAt?.toISOString() ?? null,
    pollInterval: s.pollInterval,
    errorMessage: s.errorMessage,
    hasCredentials: !!s.config && Object.keys(s.config as object).length > 0,
    _count: s._count,
  }));

  return <ServicesClient initial={mapped} />;
}

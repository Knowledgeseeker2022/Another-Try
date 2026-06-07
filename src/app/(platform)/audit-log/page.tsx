import { db } from "@/lib/db";
import { AuditClient } from "./audit-client";

export default async function AuditLogPage() {
  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.auditLog.count(),
  ]);

  const mapped = entries.map((e) => ({
    id: e.id,
    action: e.action,
    resource: e.resource,
    resourceId: e.resourceId,
    metadata: e.metadata as Record<string, unknown> | null,
    ipAddress: e.ipAddress,
    createdAt: e.createdAt.toISOString(),
    user: e.user,
  }));

  return <AuditClient initial={mapped} initialTotal={total} />;
}

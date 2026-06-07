import { db } from "@/lib/db";
import { ApiKeysClient } from "./api-keys-client";

export default async function ApiKeysPage() {
  const keys = await db.apiKey.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const mapped = keys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    status: k.status as "ACTIVE" | "REVOKED" | "EXPIRED",
    scopes: k.scopes,
    user: k.user,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));

  return <ApiKeysClient initial={mapped} />;
}

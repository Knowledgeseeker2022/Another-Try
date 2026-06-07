import { db } from "@/lib/db";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const users = await db.user.findMany({
    select: {
      id: true, name: true, email: true, isActive: true,
      mfaEnabled: true, lastLoginAt: true, createdAt: true,
      userRoles: { include: { role: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped = users.map((u) => ({
    ...u,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  }));

  return <UsersClient initial={mapped} />;
}

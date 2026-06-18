import { db } from "@/lib/db";
import { UsersClient } from "./users-client";
import { userSelect } from "@/app/api/users/route";

export default async function UsersPage() {
  const users = await db.user.findMany({
    select: userSelect,
    orderBy: { createdAt: "desc" },
  });

  const mapped = users.map((u) => ({
    ...u,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  }));

  return <UsersClient initial={mapped} />;
}

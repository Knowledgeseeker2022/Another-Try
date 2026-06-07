import { db } from "@/lib/db";
import { GroupsClient } from "./groups-client";

export default async function GroupsPage() {
  const groups = await db.group.findMany({
    include: {
      _count: { select: { userGroups: true } },
      groupRoles: { include: { role: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
  });

  const mapped = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    createdAt: g.createdAt.toISOString(),
    memberCount: g._count.userGroups,
    roles: g.groupRoles.map((r) => r.role.name),
  }));

  return <GroupsClient initial={mapped} />;
}

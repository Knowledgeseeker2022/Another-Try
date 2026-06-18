import { db } from "@/lib/db";
import { GroupsClient } from "./groups-client";

export default async function GroupsPage() {
  const groups = await db.group.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      _count: { select: { userGroups: true } },
      userGroups: { select: { user: { select: { id: true, name: true, email: true } } } },
      groupRoles: {
        select: {
          id: true,
          appId: true,
          scopeAllOrgs: true,
          role: { select: { id: true, name: true } },
          app: { select: { id: true, name: true } },
          orgs: { select: { orgId: true } },
          orgGroups: { select: { orgGroupId: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const mapped = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    createdAt: g.createdAt.toISOString(),
    memberCount: g._count.userGroups,
    members: g.userGroups.map((ug) => ug.user),
    grants: g.groupRoles,
  }));

  return <GroupsClient initial={mapped} />;
}

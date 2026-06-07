import { db } from "@/lib/db";
import { RolesClient } from "./roles-client";

export default async function RolesPage() {
  const roles = await db.role.findMany({
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { userRoles: true } },
    },
    orderBy: { name: "asc" },
  });

  const mapped = roles.map((role) => {
    const byResource: Record<string, string[]> = {};
    for (const rp of role.permissions) {
      const { resource, action } = rp.permission;
      const key = resource.charAt(0).toUpperCase() + resource.slice(1);
      (byResource[key] ??= []).push(action.charAt(0).toUpperCase() + action.slice(1));
    }
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      byResource,
      userCount: role._count.userRoles,
    };
  });

  return <RolesClient initial={mapped} />;
}

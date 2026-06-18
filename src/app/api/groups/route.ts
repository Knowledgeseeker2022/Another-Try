import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";

// Shared shape: members plus role grants (with app + client-org scope).
export const groupSelect = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  _count: { select: { userGroups: true } },
  userGroups: {
    select: { user: { select: { id: true, name: true, email: true } } },
  },
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
} as const;

export async function GET() {
  const authz = await requirePermission("groups", "read");
  if (!authz.ok) return authz.response;

  const groups = await db.group.findMany({ select: groupSelect, orderBy: { name: "asc" } });
  return NextResponse.json(groups);
}

export async function POST(req: Request) {
  const authz = await requirePermission("groups", "write");
  if (!authz.ok) return authz.response;

  const { name, description } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const group = await db.group.create({ data: { name, description } });

  await db.auditLog.create({
    data: {
      action: "group.created",
      resource: "Group",
      resourceId: group.id,
      userId: authz.userId,
      metadata: { name, description: description ?? null },
    },
  });

  const created = await db.group.findUnique({ where: { id: group.id }, select: groupSelect });
  return NextResponse.json(created, { status: 201 });
}

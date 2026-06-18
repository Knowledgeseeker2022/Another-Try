import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";

export async function GET() {
  const authz = await requirePermission("roles", "read");
  if (!authz.ok) return authz.response;

  const roles = await db.role.findMany({
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { userRoles: true, groupRoles: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(roles);
}

export async function POST(req: Request) {
  const authz = await requirePermission("roles", "write");
  if (!authz.ok) return authz.response;

  const body = await req.json();
  const { name, description } = body;
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const role = await db.role.create({ data: { name, description } });

  await db.auditLog.create({
    data: {
      action: "role.created",
      resource: "Role",
      resourceId: role.id,
      userId: authz.userId,
      metadata: { name, description: description ?? null },
    },
  });

  return NextResponse.json(role, { status: 201 });
}

// Edit a role: name/description (custom roles only) and/or its permission set.
// `permissions` is the full desired set: [{ resource, action }, ...].
export async function PATCH(req: Request) {
  const authz = await requirePermission("roles", "write");
  if (!authz.ok) return authz.response;

  const body = await req.json();
  const { id, name, description, permissions } = body as {
    id?: string;
    name?: string;
    description?: string;
    permissions?: { resource: string; action: string }[];
  };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const role = await db.role.findUnique({ where: { id } });
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // System roles keep their name (referenced elsewhere); description/permissions are editable.
  const data: Record<string, unknown> = {};
  if (name !== undefined && !role.isSystem) data.name = name;
  if (description !== undefined) data.description = description;

  await db.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.role.update({ where: { id }, data });
    }

    if (Array.isArray(permissions)) {
      // Resolve the desired (resource, action) pairs to permission ids.
      const wanted = await tx.permission.findMany({
        where: { OR: permissions.map((p) => ({ resource: p.resource, action: p.action })) },
        select: { id: true },
      });
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      if (wanted.length > 0) {
        await tx.rolePermission.createMany({
          data: wanted.map((p) => ({ roleId: id, permissionId: p.id })),
          skipDuplicates: true,
        });
      }
    }
  });

  await db.auditLog.create({
    data: {
      action: "role.updated",
      resource: "Role",
      resourceId: id,
      userId: authz.userId,
      metadata: {
        name: (data.name as string) ?? null,
        description: (data.description as string) ?? null,
        permissionCount: Array.isArray(permissions) ? permissions.length : null,
      },
    },
  });

  const updated = await db.role.findUnique({
    where: { id },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { userRoles: true, groupRoles: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const authz = await requirePermission("roles", "delete");
  if (!authz.ok) return authz.response;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const role = await db.role.findUnique({ where: { id } });
  if (!role) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (role.isSystem) return NextResponse.json({ error: "System roles cannot be deleted" }, { status: 403 });

  await db.role.delete({ where: { id } });

  await db.auditLog.create({
    data: {
      action: "role.deleted",
      resource: "Role",
      resourceId: id,
      userId: authz.userId,
      metadata: { name: role.name },
    },
  });

  return NextResponse.json({ ok: true });
}

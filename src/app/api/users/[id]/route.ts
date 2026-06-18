import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission, setUserGrants, type GrantInput } from "@/lib/authz";
import { userSelect } from "../route";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requirePermission("users", "read");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const user = await db.user.findUnique({ where: { id }, select: userSelect });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requirePermission("users", "write");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const body = await req.json();
  const { name, isActive, roleIds, grants } = body as {
    name?: string;
    isActive?: boolean;
    roleIds?: string[]; // legacy: global grants
    grants?: GrantInput[];
  };

  const existing = await db.user.findUnique({ where: { id }, select: { isActive: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (isActive !== undefined) updateData.isActive = isActive;

  // Deactivating revokes any live JWT session immediately (tokenVersion bump).
  if (isActive === false && existing.isActive) {
    updateData.tokenVersion = { increment: 1 };
  }

  await db.user.update({ where: { id }, data: updateData });

  // Replace grants if provided (scoped `grants` preferred; `roleIds` = global).
  if (Array.isArray(grants)) {
    await setUserGrants(id, grants);
  } else if (Array.isArray(roleIds)) {
    await setUserGrants(id, roleIds.map((roleId) => ({ roleId, scopeAllOrgs: true })));
  }

  await db.auditLog.create({
    data: {
      action: "user.updated",
      resource: "User",
      resourceId: id,
      userId: authz.userId,
      metadata: {
        name: name ?? null,
        isActive: isActive ?? null,
        grants: (grants ?? (roleIds ? roleIds.map((roleId) => ({ roleId })) : null)) as unknown as Prisma.InputJsonValue,
      },
    },
  });

  const updated = await db.user.findUnique({ where: { id }, select: userSelect });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requirePermission("users", "delete");
  if (!authz.ok) return authz.response;

  const { id } = await params;

  if (authz.userId === id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id }, select: { email: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.user.delete({ where: { id } });

  await db.auditLog.create({
    data: {
      action: "user.deleted",
      resource: "User",
      resourceId: id,
      userId: authz.userId,
      metadata: { email: user.email },
    },
  });

  return NextResponse.json({ ok: true });
}

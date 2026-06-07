import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, isActive: true,
      mfaEnabled: true, lastLoginAt: true, createdAt: true,
      userRoles: { include: { role: { select: { id: true, name: true } } } },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { name, isActive, roleIds } = body;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (isActive !== undefined) updateData.isActive = isActive;

  const user = await db.user.update({ where: { id }, data: updateData });

  // Replace all role assignments if roleIds provided
  if (Array.isArray(roleIds)) {
    await db.userRole.deleteMany({ where: { userId: id } });
    if (roleIds.length > 0) {
      await db.userRole.createMany({
        data: roleIds.map((roleId: string) => ({ userId: id, roleId })),
        skipDuplicates: true,
      });
    }
  }

  await db.auditLog.create({
    data: {
      action: "user.updated",
      resource: "User",
      resourceId: id,
      userId: session.user?.id ?? null,
      metadata: { name, isActive, roleIds },
    },
  });

  const updated = await db.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, isActive: true,
      mfaEnabled: true, lastLoginAt: true, createdAt: true,
      userRoles: { include: { role: { select: { id: true, name: true } } } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  if (session.user?.id === id) {
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
      userId: session.user?.id ?? null,
      metadata: { email: user.email },
    },
  });

  return NextResponse.json({ ok: true });
}

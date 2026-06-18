import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission, setGroupGrants, type GrantInput } from "@/lib/authz";
import { groupSelect } from "../route";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requirePermission("groups", "read");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const group = await db.group.findUnique({ where: { id }, select: groupSelect });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(group);
}

// Edit a group: name/description, membership (memberIds), and/or role grants.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requirePermission("groups", "write");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const body = await req.json();
  const { name, description, memberIds, grants } = body as {
    name?: string;
    description?: string;
    memberIds?: string[];
    grants?: GrantInput[];
  };

  const group = await db.group.findUnique({ where: { id }, select: { id: true } });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (Object.keys(data).length > 0) {
    await db.group.update({ where: { id }, data });
  }

  // Replace membership if provided.
  if (Array.isArray(memberIds)) {
    await db.$transaction([
      db.userGroup.deleteMany({ where: { groupId: id } }),
      db.userGroup.createMany({
        data: [...new Set(memberIds)].map((userId) => ({ userId, groupId: id })),
        skipDuplicates: true,
      }),
    ]);
  }

  // Replace role grants if provided.
  if (Array.isArray(grants)) {
    await setGroupGrants(id, grants);
  }

  await db.auditLog.create({
    data: {
      action: "group.updated",
      resource: "Group",
      resourceId: id,
      userId: authz.userId,
      metadata: {
        name: name ?? null,
        memberCount: Array.isArray(memberIds) ? memberIds.length : null,
        grants: (grants ?? null) as unknown as Prisma.InputJsonValue,
      },
    },
  });

  const updated = await db.group.findUnique({ where: { id }, select: groupSelect });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authz = await requirePermission("groups", "delete");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const group = await db.group.findUnique({ where: { id }, select: { name: true } });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.group.delete({ where: { id } });

  await db.auditLog.create({
    data: {
      action: "group.deleted",
      resource: "Group",
      resourceId: id,
      userId: authz.userId,
      metadata: { name: group.name },
    },
  });

  return NextResponse.json({ ok: true });
}

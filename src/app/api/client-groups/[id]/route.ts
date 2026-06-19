import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { getRuleGroupMemberCount } from "@/lib/group-rules";
import { isValidSegment, RULE_ATTRIBUTES } from "@/lib/client-segments";
import type { Prisma } from "@prisma/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("orgs", "read");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const group = await db.orgGroup.findUnique({
    where: { id },
    include: { _count: { select: { members: true } } },
  });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const memberCount =
    group.mode === "RULE_BASED"
      ? await getRuleGroupMemberCount(group, db)
      : group._count.members;

  return NextResponse.json({ ...group, memberCount });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("orgs", "write");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const body = await req.json() as {
    name?: string;
    description?: string | null;
    color?: string;
    mode?: "MANUAL" | "RULE_BASED";
    ruleAttribute?: string | null;
    ruleValue?: string | null;
  };

  const existing = await db.orgGroup.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const mode = body.mode ?? existing.mode;

  if (mode === "RULE_BASED") {
    const attr = body.ruleAttribute ?? existing.ruleAttribute;
    const val = body.ruleValue ?? existing.ruleValue;
    if (!attr || !(RULE_ATTRIBUTES as readonly string[]).includes(attr)) {
      return NextResponse.json({ error: "Invalid ruleAttribute" }, { status: 400 });
    }
    if (attr === "segment" && (!val || !isValidSegment(val))) {
      return NextResponse.json({ error: "Invalid segment ruleValue" }, { status: 400 });
    }
  }

  const data: Prisma.OrgGroupUpdateInput = {};
  if (body.name        !== undefined) data.name          = body.name.trim();
  if (body.description !== undefined) data.description   = body.description;
  if (body.color       !== undefined) data.color         = body.color;
  if (body.mode        !== undefined) {
    data.mode = body.mode;
    if (body.mode === "MANUAL") {
      data.ruleAttribute = null;
      data.ruleValue     = null;
    }
  }
  if (body.ruleAttribute !== undefined) data.ruleAttribute = body.ruleAttribute;
  if (body.ruleValue     !== undefined) data.ruleValue     = body.ruleValue;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updatable fields" }, { status: 400 });
  }

  const group = await db.orgGroup.update({ where: { id }, data });

  await db.auditLog.create({
    data: {
      action: "client_group.updated",
      resource: "OrgGroup",
      resourceId: id,
      userId: authz.userId,
      metadata: data as Prisma.InputJsonObject,
    },
  });

  return NextResponse.json(group);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("orgs", "delete");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const group = await db.orgGroup.findUnique({ where: { id }, select: { name: true } });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.orgGroup.delete({ where: { id } });

  await db.auditLog.create({
    data: {
      action: "client_group.deleted",
      resource: "OrgGroup",
      resourceId: id,
      userId: authz.userId,
      metadata: { name: group.name },
    },
  });

  return NextResponse.json({ success: true });
}

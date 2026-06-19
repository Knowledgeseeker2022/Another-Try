import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { getRuleGroupMembers } from "@/lib/group-rules";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("orgs", "read");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const group = await db.orgGroup.findUnique({ where: { id } });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (group.mode === "RULE_BASED") {
    const members = await getRuleGroupMembers(group, db);
    return NextResponse.json(members);
  }

  const rows = await db.orgGroupMember.findMany({
    where: { orgGroupId: id },
    include: {
      organization: { select: { id: true, name: true, segment: true, status: true } },
    },
    orderBy: { organization: { name: "asc" } },
  });
  return NextResponse.json(rows.map((r) => r.organization));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("orgs", "write");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const group = await db.orgGroup.findUnique({ where: { id } });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (group.mode === "RULE_BASED") {
    return NextResponse.json(
      { error: "Cannot manually add members to a rule-based group" },
      { status: 400 },
    );
  }

  const { orgId } = await req.json() as { orgId?: string };
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  await db.orgGroupMember.upsert({
    where: { orgId_orgGroupId: { orgId, orgGroupId: id } },
    create: { orgId, orgGroupId: id },
    update: {},
  });

  await db.auditLog.create({
    data: {
      action: "client_group.member_added",
      resource: "OrgGroupMember",
      resourceId: id,
      userId: authz.userId,
      metadata: { orgId, orgGroupId: id },
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("orgs", "write");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const group = await db.orgGroup.findUnique({ where: { id } });
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (group.mode === "RULE_BASED") {
    return NextResponse.json(
      { error: "Cannot manually remove members from a rule-based group" },
      { status: 400 },
    );
  }

  const { orgId } = await req.json() as { orgId?: string };
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  await db.orgGroupMember.deleteMany({
    where: { orgId, orgGroupId: id },
  });

  return NextResponse.json({ success: true });
}

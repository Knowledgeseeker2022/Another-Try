import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { getRuleGroupMemberCount } from "@/lib/group-rules";
import { isValidSegment, RULE_ATTRIBUTES } from "@/lib/client-segments";
import type { Prisma } from "@prisma/client";

export async function GET() {
  const authz = await requirePermission("orgs", "read");
  if (!authz.ok) return authz.response;

  const groups = await db.orgGroup.findMany({
    include: { _count: { select: { members: true } } },
    orderBy: { name: "asc" },
  });

  // Compute live member counts for RULE_BASED groups.
  const withCounts = await Promise.all(
    groups.map(async (g) => {
      const memberCount =
        g.mode === "RULE_BASED"
          ? await getRuleGroupMemberCount(g, db)
          : g._count.members;
      return { ...g, memberCount };
    }),
  );

  return NextResponse.json(withCounts);
}

export async function POST(req: Request) {
  const authz = await requirePermission("orgs", "write");
  if (!authz.ok) return authz.response;

  const body = await req.json() as {
    name?: string;
    description?: string | null;
    color?: string;
    mode?: "MANUAL" | "RULE_BASED";
    ruleAttribute?: string | null;
    ruleValue?: string | null;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const mode = body.mode === "RULE_BASED" ? "RULE_BASED" : "MANUAL";

  if (mode === "RULE_BASED") {
    if (!body.ruleAttribute || !(RULE_ATTRIBUTES as readonly string[]).includes(body.ruleAttribute)) {
      return NextResponse.json({ error: "Invalid ruleAttribute" }, { status: 400 });
    }
    if (body.ruleAttribute === "segment" && (!body.ruleValue || !isValidSegment(body.ruleValue))) {
      return NextResponse.json({ error: "Invalid segment ruleValue" }, { status: 400 });
    }
  }

  const group = await db.orgGroup.create({
    data: {
      name: body.name.trim(),
      description: body.description ?? null,
      color: body.color ?? "#6b7280",
      mode,
      ruleAttribute: mode === "RULE_BASED" ? (body.ruleAttribute ?? null) : null,
      ruleValue: mode === "RULE_BASED" ? (body.ruleValue ?? null) : null,
    },
  });

  await db.auditLog.create({
    data: {
      action: "client_group.created",
      resource: "OrgGroup",
      resourceId: group.id,
      userId: authz.userId,
      metadata: { name: group.name, mode, ruleAttribute: group.ruleAttribute, ruleValue: group.ruleValue } as Prisma.InputJsonObject,
    },
  });

  return NextResponse.json({ ...group, memberCount: 0 }, { status: 201 });
}

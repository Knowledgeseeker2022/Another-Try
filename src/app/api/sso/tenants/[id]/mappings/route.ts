import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";

const mappingSelect = {
  id: true,
  entraGroupId: true,
  entraGroupName: true,
  groupId: true,
  createdAt: true,
  group: { select: { id: true, name: true, description: true } },
} as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("sso", "read");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const tenant = await db.ssoTenant.findUnique({ where: { id }, select: { id: true } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const mappings = await db.ssoGroupMapping.findMany({
    where: { ssoTenantId: id },
    select: mappingSelect,
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(mappings);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("sso", "write");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const tenant = await db.ssoTenant.findUnique({ where: { id }, select: { id: true } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as {
    entraGroupId: string;
    entraGroupName?: string;
    groupId: string;
  };

  if (!body.entraGroupId?.trim()) {
    return NextResponse.json({ error: "entraGroupId is required" }, { status: 400 });
  }
  if (!body.groupId?.trim()) {
    return NextResponse.json({ error: "groupId is required" }, { status: 400 });
  }

  const mapping = await db.ssoGroupMapping.create({
    data: {
      ssoTenantId: id,
      entraGroupId: body.entraGroupId.trim(),
      entraGroupName: body.entraGroupName?.trim() || null,
      groupId: body.groupId,
    },
    select: mappingSelect,
  });

  await db.auditLog.create({
    data: {
      action: "sso.mapping.created",
      resource: "SsoGroupMapping",
      resourceId: mapping.id,
      userId: authz.userId,
      metadata: {
        ssoTenantId: id,
        entraGroupId: body.entraGroupId,
        entraGroupName: body.entraGroupName ?? null,
        groupId: body.groupId,
      },
    },
  });

  return NextResponse.json(mapping, { status: 201 });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { invalidateCache } from "@/lib/redis";
import { ensureDomainAuths } from "@/lib/org-matcher";
import type { OrgStatus, Prisma } from "@prisma/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("orgs", "read");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const org = await db.organization.findUnique({
    where: { id },
    include: {
      mappings: { orderBy: { createdAt: "asc" } },
      domainAuths: true,
      matchSuggestions: {
        where: { status: "PENDING" },
        orderBy: { confidence: "desc" },
      },
      orgGroups: { include: { orgGroup: true } },
      ssoTenants: { select: { id: true, name: true, tenantId: true, isEnabled: true } },
      _count: { select: { tickets: true, securityEvents: true, cloudUsers: true } },
    },
  });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await ensureDomainAuths(id, db);
  const domainAuths =
    org.domainAuths.length < 4
      ? await db.orgDomainAuth.findMany({ where: { orgId: id } })
      : org.domainAuths;

  return NextResponse.json({ ...org, domainAuths });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("orgs", "write");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const body = await req.json() as {
    name?: string; segment?: string | null; domains?: string[]; industry?: string | null;
    tier?: string | null; status?: OrgStatus; notes?: string | null;
  };

  const data: {
    name?: string; segment?: string | null; domains?: string[]; industry?: string | null;
    tier?: string | null; status?: OrgStatus; notes?: string | null;
  } = {};

  if (body.name     !== undefined) data.name     = body.name;
  if (body.segment  !== undefined) data.segment  = body.segment;
  if (body.domains  !== undefined) data.domains  = body.domains;
  if (body.industry !== undefined) data.industry = body.industry;
  if (body.tier     !== undefined) data.tier     = body.tier;
  if (body.status   !== undefined) data.status   = body.status;
  if (body.notes    !== undefined) data.notes    = body.notes;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 });
  }

  const org = await db.organization.update({ where: { id }, data });
  await invalidateCache("orgs:*");

  await db.auditLog.create({
    data: {
      action: "org.updated",
      resource: "Organization",
      resourceId: id,
      userId: authz.userId,
      metadata: data as unknown as Prisma.InputJsonObject,
    },
  });

  return NextResponse.json(org);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("orgs", "delete");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const org = await db.organization.findUnique({ where: { id }, select: { name: true } });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.organization.delete({ where: { id } });
  await invalidateCache("orgs:*");

  await db.auditLog.create({
    data: {
      action: "org.deleted",
      resource: "Organization",
      resourceId: id,
      userId: authz.userId,
      metadata: { name: org.name },
    },
  });

  return NextResponse.json({ success: true });
}

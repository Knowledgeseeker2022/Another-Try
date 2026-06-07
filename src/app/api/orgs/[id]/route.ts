import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invalidateCache } from "@/lib/redis";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const org = await db.organization.findUnique({
    where: { id },
    include: { mappings: true, orgGroups: { include: { orgGroup: true } } },
  });
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(org);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { confirmMappings, name, domain, tier, status } = body;

  // Confirm all unconfirmed mappings for this org
  if (confirmMappings) {
    await db.orgMapping.updateMany({
      where: { orgId: id, isConfirmed: false },
      data: { isConfirmed: true },
    });
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (domain !== undefined) updateData.domain = domain;
  if (tier !== undefined) updateData.tier = tier;
  if (status !== undefined) updateData.status = status;

  const org = Object.keys(updateData).length > 0
    ? await db.organization.update({ where: { id }, data: updateData })
    : await db.organization.findUnique({ where: { id } });

  await invalidateCache("orgs:*");
  await db.auditLog.create({
    data: {
      action: "org.updated",
      resource: "Organization",
      resourceId: id,
      userId: session.user?.id ?? null,
      metadata: { confirmMappings, ...updateData },
    },
  });

  return NextResponse.json(org);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const org = await db.organization.findUnique({ where: { id }, select: { name: true } });
  await db.organization.delete({ where: { id } });
  await invalidateCache("orgs:*");

  await db.auditLog.create({
    data: {
      action: "org.deleted",
      resource: "Organization",
      resourceId: id,
      userId: session.user?.id ?? null,
      metadata: { name: org?.name ?? null },
    },
  });

  return NextResponse.json({ success: true });
}

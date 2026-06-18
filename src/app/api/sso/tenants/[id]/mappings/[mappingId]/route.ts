import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; mappingId: string }> },
) {
  const authz = await requirePermission("sso", "delete");
  if (!authz.ok) return authz.response;

  const { id, mappingId } = await params;
  const mapping = await db.ssoGroupMapping.findUnique({
    where: { id: mappingId },
    select: { id: true, ssoTenantId: true, entraGroupId: true, groupId: true },
  });
  if (!mapping || mapping.ssoTenantId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.ssoGroupMapping.delete({ where: { id: mappingId } });

  await db.auditLog.create({
    data: {
      action: "sso.mapping.deleted",
      resource: "SsoGroupMapping",
      resourceId: mappingId,
      userId: authz.userId,
      metadata: {
        ssoTenantId: id,
        entraGroupId: mapping.entraGroupId,
        groupId: mapping.groupId,
      },
    },
  });

  return NextResponse.json({ ok: true });
}

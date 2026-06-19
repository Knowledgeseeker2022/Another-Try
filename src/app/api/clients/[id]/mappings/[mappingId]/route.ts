import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { reverseBackfill } from "@/lib/org-matcher";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; mappingId: string }> },
) {
  const authz = await requirePermission("orgs", "delete");
  if (!authz.ok) return authz.response;

  const { id: orgId, mappingId } = await params;

  const mapping = await db.orgMapping.findUnique({ where: { id: mappingId } });
  if (!mapping) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (mapping.orgId !== orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await db.$transaction(
    async (tx) => {
      const reversed = await reverseBackfill(tx, mappingId);

      await tx.orgMapping.delete({ where: { id: mappingId } });

      await tx.orgMatchSuggestion.upsert({
        where: {
          serviceSlug_externalId: { serviceSlug: mapping.serviceSlug, externalId: mapping.externalId },
        },
        create: {
          orgId: mapping.orgId,
          serviceSlug: mapping.serviceSlug,
          externalId: mapping.externalId,
          externalName: mapping.externalName,
          confidence: mapping.confidence,
          matcherKey: mapping.matcherKey ?? "manual",
          status: "REJECTED",
          reviewedById: authz.userId,
          reviewedAt: new Date(),
        },
        update: {
          status: "REJECTED",
          orgMappingId: null,
          reviewedById: authz.userId,
          reviewedAt: new Date(),
        },
      });

      return reversed;
    },
    { timeout: 30_000 },
  );

  await db.auditLog.create({
    data: {
      action: "org.mapping.split",
      resource: "OrgMapping",
      resourceId: mappingId,
      userId: authz.userId,
      metadata: {
        orgId,
        serviceSlug: mapping.serviceSlug,
        externalId: mapping.externalId,
        reversed: result,
      },
    },
  });

  return NextResponse.json({ success: true, reversed: result });
}

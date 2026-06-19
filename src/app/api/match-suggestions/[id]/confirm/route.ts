import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { backfillMappingRecords } from "@/lib/org-matcher";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("orgs", "write");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const suggestion = await db.orgMatchSuggestion.findUnique({ where: { id } });
  if (!suggestion) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (suggestion.status !== "PENDING") {
    return NextResponse.json({ error: `Suggestion is already ${suggestion.status}` }, { status: 409 });
  }

  const { mapping, backfill } = await db.$transaction(
    async (tx) => {
      const m = await tx.orgMapping.upsert({
        where: {
          serviceSlug_externalId: {
            serviceSlug: suggestion.serviceSlug,
            externalId: suggestion.externalId,
          },
        },
        create: {
          orgId: suggestion.orgId,
          serviceSlug: suggestion.serviceSlug,
          externalId: suggestion.externalId,
          externalName: suggestion.externalName,
          confidence: suggestion.confidence,
          isConfirmed: true,
          matcherKey: suggestion.matcherKey,
          wasAutoLinked: false,
        },
        update: {
          orgId: suggestion.orgId,
          isConfirmed: true,
          confidence: suggestion.confidence,
          matcherKey: suggestion.matcherKey,
          wasAutoLinked: false,
        },
      });

      await tx.orgMatchSuggestion.update({
        where: { id },
        data: {
          status: "CONFIRMED",
          orgMappingId: m.id,
          reviewedById: authz.userId,
          reviewedAt: new Date(),
        },
      });

      const bf = await backfillMappingRecords(
        tx,
        m.id,
        suggestion.orgId,
        suggestion.serviceSlug,
        suggestion.externalId,
      );

      return { mapping: m, backfill: bf };
    },
    { timeout: 30_000 },
  );

  await db.auditLog.create({
    data: {
      action: "org.suggestion.confirmed",
      resource: "OrgMatchSuggestion",
      resourceId: id,
      userId: authz.userId,
      metadata: {
        orgId: suggestion.orgId,
        serviceSlug: suggestion.serviceSlug,
        externalId: suggestion.externalId,
        mappingId: mapping.id,
        backfill,
      },
    },
  });

  return NextResponse.json({ success: true, mappingId: mapping.id, backfill });
}

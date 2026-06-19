import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";

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

  await db.orgMatchSuggestion.update({
    where: { id },
    data: {
      status: "REJECTED",
      reviewedById: authz.userId,
      reviewedAt: new Date(),
    },
  });

  await db.auditLog.create({
    data: {
      action: "org.suggestion.rejected",
      resource: "OrgMatchSuggestion",
      resourceId: id,
      userId: authz.userId,
      metadata: {
        orgId: suggestion.orgId,
        serviceSlug: suggestion.serviceSlug,
        externalId: suggestion.externalId,
        externalName: suggestion.externalName,
      },
    },
  });

  return NextResponse.json({ success: true });
}

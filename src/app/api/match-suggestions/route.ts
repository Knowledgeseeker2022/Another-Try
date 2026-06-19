import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import type { OrgSuggestionStatus } from "@prisma/client";

export async function GET(req: Request) {
  const authz = await requirePermission("orgs", "read");
  if (!authz.ok) return authz.response;

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "PENDING") as OrgSuggestionStatus;

  const suggestions = await db.orgMatchSuggestion.findMany({
    where: { status },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ confidence: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(suggestions);
}

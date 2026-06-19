import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { ensureDomainAuths } from "@/lib/org-matcher";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("orgs", "read");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  await ensureDomainAuths(id, db);

  const auths = await db.orgDomainAuth.findMany({
    where: { orgId: id },
    orderBy: { domain: "asc" },
  });
  return NextResponse.json(auths);
}

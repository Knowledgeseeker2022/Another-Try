import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import type { DataDomain, DomainAuthStatus } from "@prisma/client";

const VALID_DOMAINS: DataDomain[] = ["IDENTITY", "VULNERABILITY", "COMPLIANCE", "OPERATIONS"];
const VALID_STATUSES: DomainAuthStatus[] = ["UNKNOWN", "AUTHORIZED", "NOT_AUTHORIZED"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; domain: string }> },
) {
  const authz = await requirePermission("orgs", "write");
  if (!authz.ok) return authz.response;

  const { id: orgId, domain: rawDomain } = await params;
  const domain = rawDomain.toUpperCase() as DataDomain;
  if (!(VALID_DOMAINS as string[]).includes(domain)) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const { status, notes } = await req.json() as { status?: string; notes?: string };
  if (!status || !(VALID_STATUSES as string[]).includes(status)) {
    return NextResponse.json({ error: "status must be UNKNOWN | AUTHORIZED | NOT_AUTHORIZED" }, { status: 400 });
  }

  const typedStatus = status as DomainAuthStatus;
  const auth = await db.orgDomainAuth.upsert({
    where: { orgId_domain: { orgId, domain } },
    create: { orgId, domain, status: typedStatus, notes },
    update: {
      status: typedStatus,
      notes: notes ?? null,
      authorizedAt: typedStatus === "AUTHORIZED" ? new Date() : null,
    },
  });

  await db.auditLog.create({
    data: {
      action: "org.domain_auth.updated",
      resource: "OrgDomainAuth",
      resourceId: auth.id,
      userId: authz.userId,
      metadata: { orgId, domain, status, notes: notes ?? null },
    },
  });

  return NextResponse.json(auth);
}

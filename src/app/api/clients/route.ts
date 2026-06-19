import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { invalidateCache } from "@/lib/redis";
import { ensureDomainAuths } from "@/lib/org-matcher";
import { isValidSegment } from "@/lib/client-segments";
import { getClientGroups } from "@/lib/group-rules";

export async function GET(req: Request) {
  const authz = await requirePermission("orgs", "read");
  if (!authz.ok) return authz.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const pending = searchParams.get("pending") === "true";

  const orgs = await db.organization.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(pending ? { matchSuggestions: { some: { status: "PENDING" } } } : {}),
    },
    include: {
      mappings: { orderBy: { createdAt: "asc" } },
      domainAuths: true,
      matchSuggestions: {
        where: { status: "PENDING" },
        select: {
          id: true, externalName: true, externalId: true,
          serviceSlug: true, confidence: true, matcherKey: true, matchEvidence: true,
        },
      },
      orgGroups: { include: { orgGroup: true } },
      _count: { select: { tickets: true, securityEvents: true, cloudUsers: true } },
    },
    orderBy: { name: "asc" },
  });

  // Augment each org with rule-based group memberships (computed on read).
  const withGroups = await Promise.all(
    orgs.map(async (org) => {
      const allGroups = await getClientGroups(org, db);
      return { ...org, allGroups };
    }),
  );

  return NextResponse.json(withGroups);
}

export async function POST(req: Request) {
  const authz = await requirePermission("orgs", "write");
  if (!authz.ok) return authz.response;

  const body = await req.json() as {
    name?: string; slug?: string; segment?: string;
    domains?: string[]; industry?: string; tier?: string; notes?: string;
  };

  const { name, slug, segment, domains, industry, tier, notes } = body;
  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  }
  if (segment && !isValidSegment(segment)) {
    return NextResponse.json({ error: `Invalid segment. Valid values: ${["Financial","Federal","Healthcare","Legal","Technology","Education","Nonprofit","Manufacturing","Professional Services","Retail"].join(", ")}` }, { status: 400 });
  }

  const org = await db.organization.create({
    data: {
      name: name.trim(),
      slug: slug.trim(),
      segment: segment ?? undefined,
      domains: domains ?? [],
      industry: industry ?? undefined,
      tier: tier ?? undefined,
      notes: notes ?? undefined,
    },
  });

  await ensureDomainAuths(org.id, db);
  await invalidateCache("orgs:*");

  await db.auditLog.create({
    data: {
      action: "org.created",
      resource: "Organization",
      resourceId: org.id,
      userId: authz.userId,
      metadata: { name, slug, segment, domains, tier },
    },
  });

  return NextResponse.json(org, { status: 201 });
}

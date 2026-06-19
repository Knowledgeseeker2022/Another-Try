import type { PrismaClient, Prisma } from "@prisma/client";

export interface MatchInput {
  serviceSlug: string;
  externalId: string;
  externalName?: string | null;
  domain?: string | null;
  tenantId?: string | null;
}

export interface MatchResult {
  orgId: string;
  confidence: number;
  matcherKey: string;
  matchEvidence: Record<string, unknown>;
}

const HIGH_THRESHOLD = 90;  // auto-link
const LOW_THRESHOLD  = 65;  // below this: leave unmatched

// Strip common legal suffixes so "Acme Inc." and "Acme LLC" normalize identically.
const SUFFIX_RE = /\b(incorporated|corporation|company|limited|inc|llc|ltd|corp|co|llp|plc)\b\.?/gi;

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(SUFFIX_RE, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Run deterministic matchers in priority order. Returns highest-confidence result or null.
export async function matchOrg(
  input: Pick<MatchInput, "externalName" | "domain" | "tenantId">,
  db: PrismaClient,
): Promise<MatchResult | null> {
  // 1. Verified Entra tenant ID (confidence 100) — cryptographically verified, immutable
  if (input.tenantId) {
    const ssoTenant = await db.ssoTenant.findUnique({
      where: { tenantId: input.tenantId },
      select: { orgId: true },
    });
    if (ssoTenant?.orgId) {
      return {
        orgId: ssoTenant.orgId,
        confidence: 100,
        matcherKey: "entra_tid",
        matchEvidence: { tid: input.tenantId },
      };
    }
  }

  // 2a. Verified domain match via SsoTenant.domains (confidence 90) — verified by Entra
  if (input.domain) {
    const domain = input.domain.toLowerCase();
    const ssoMatch = await db.ssoTenant.findFirst({
      where: { domains: { has: domain }, orgId: { not: null } },
      select: { orgId: true },
    });
    if (ssoMatch?.orgId) {
      return {
        orgId: ssoMatch.orgId,
        confidence: 90,
        matcherKey: "verified_domain",
        matchEvidence: { domain },
      };
    }

    // 2b. Manual domain match via Organization.domains (confidence 80) — manually set
    const orgMatch = await db.organization.findFirst({
      where: { domains: { has: domain } },
      select: { id: true },
    });
    if (orgMatch) {
      return {
        orgId: orgMatch.id,
        confidence: 80,
        matcherKey: "domain",
        matchEvidence: { domain },
      };
    }
  }

  // 3. Normalized name match (confidence 70) — suffix-insensitive exact comparison
  if (input.externalName) {
    const normalized = normalizeName(input.externalName);
    if (normalized.length > 2) {
      const orgs = await db.organization.findMany({ select: { id: true, name: true } });
      for (const org of orgs) {
        if (normalizeName(org.name) === normalized) {
          return {
            orgId: org.id,
            confidence: 70,
            matcherKey: "name",
            matchEvidence: { normalizedName: normalized },
          };
        }
      }
    }
  }

  return null;
}

// Full resolver: checks existing mapping/rejected suggestion, runs matchers,
// creates OrgMapping (auto-link) or OrgMatchSuggestion (review queue).
// Returns orgId if resolved immediately, null if queued for review or unmatched.
export async function resolveOrgMapping(
  input: MatchInput,
  db: PrismaClient,
): Promise<string | null> {
  const { serviceSlug, externalId, externalName, domain, tenantId } = input;

  // Return immediately if an OrgMapping already exists
  const existing = await db.orgMapping.findUnique({
    where: { serviceSlug_externalId: { serviceSlug, externalId } },
    select: { orgId: true, isConfirmed: true },
  });
  if (existing) return existing.orgId;

  // Skip pairs that were explicitly rejected
  const rejected = await db.orgMatchSuggestion.findUnique({
    where: { serviceSlug_externalId: { serviceSlug, externalId } },
    select: { status: true },
  });
  if (rejected?.status === "REJECTED") return null;

  const match = await matchOrg({ externalName, domain, tenantId }, db);
  if (!match) return null;

  if (match.confidence >= HIGH_THRESHOLD) {
    // Auto-link: create OrgMapping directly
    const mapping = await db.orgMapping.upsert({
      where: { serviceSlug_externalId: { serviceSlug, externalId } },
      create: {
        orgId: match.orgId,
        serviceSlug,
        externalId,
        externalName: externalName ?? undefined,
        confidence: match.confidence,
        isConfirmed: true,
        matcherKey: match.matcherKey,
        wasAutoLinked: true,
      },
      update: {
        orgId: match.orgId,
        isConfirmed: true,
        confidence: match.confidence,
        matcherKey: match.matcherKey,
        wasAutoLinked: true,
      },
    });
    // Confirm any pending suggestion for this pair
    await db.orgMatchSuggestion.updateMany({
      where: { serviceSlug, externalId, status: "PENDING" },
      data: { status: "CONFIRMED", orgMappingId: mapping.id, reviewedAt: new Date() },
    });
    return match.orgId;
  }

  if (match.confidence >= LOW_THRESHOLD) {
    // Enqueue for review — upsert so re-running updates confidence in place
    await db.orgMatchSuggestion.upsert({
      where: { serviceSlug_externalId: { serviceSlug, externalId } },
      create: {
        orgId: match.orgId,
        serviceSlug,
        externalId,
        externalName: externalName ?? undefined,
        confidence: match.confidence,
        matcherKey: match.matcherKey,
        matchEvidence: match.matchEvidence as Prisma.InputJsonObject,
        status: "PENDING",
      },
      update: {
        orgId: match.orgId,
        confidence: match.confidence,
        matcherKey: match.matcherKey,
        matchEvidence: match.matchEvidence as Prisma.InputJsonObject,
      },
    });
    return null;
  }

  return null;
}

// Backfill orgId + orgMappingId onto records that belong to the confirmed mapping.
// Runs inside a transaction (Prisma interactive tx or plain PrismaClient).
// Returns row counts per table.
type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export async function backfillMappingRecords(
  tx: TxClient,
  mappingId: string,
  orgId: string,
  serviceSlug: string,
  externalId: string,
): Promise<{ tickets: number; securityEvents: number; cloudUsers: number }> {
  const BATCH = 1000;
  let tickets = 0;
  let securityEvents = 0;
  let cloudUsers = 0;

  if (serviceSlug === "halopsa") {
    let done = false;
    while (!done) {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Ticket"
        WHERE "serviceSlug" = 'halopsa'
          AND "orgId" IS NULL
          AND "rawData"->>'client_id' = ${externalId}
        ORDER BY id
        LIMIT ${BATCH}
      `;
      if (rows.length === 0) break;
      const { count } = await tx.ticket.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { orgId, orgMappingId: mappingId },
      });
      tickets += count;
      done = rows.length < BATCH;
    }
  }

  if (serviceSlug === "todyl") {
    let done = false;
    while (!done) {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "SecurityEvent"
        WHERE "serviceSlug" = 'todyl'
          AND "orgId" IS NULL
          AND "rawData"->>'tenant_id' = ${externalId}
        ORDER BY id
        LIMIT ${BATCH}
      `;
      if (rows.length === 0) break;
      const { count } = await tx.securityEvent.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { orgId, orgMappingId: mappingId },
      });
      securityEvents += count;
      done = rows.length < BATCH;
    }
  }

  if (serviceSlug === "microsoft-365") {
    let done = false;
    while (!done) {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "CloudUser"
        WHERE "serviceSlug" = 'microsoft-365'
          AND "orgId" IS NULL
        ORDER BY id
        LIMIT ${BATCH}
      `;
      if (rows.length === 0) break;
      const { count } = await tx.cloudUser.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { orgId, orgMappingId: mappingId },
      });
      cloudUsers += count;
      done = rows.length < BATCH;
    }
  }

  return { tickets, securityEvents, cloudUsers };
}

// Reverse a backfill: null out orgId + orgMappingId on exactly the records
// that were attached by this mapping, without touching other mappings' records.
export async function reverseBackfill(
  tx: TxClient,
  mappingId: string,
): Promise<{ tickets: number; securityEvents: number; cloudUsers: number }> {
  const [t, se, cu] = await Promise.all([
    tx.ticket.updateMany({
      where: { orgMappingId: mappingId },
      data: { orgId: null, orgMappingId: null },
    }),
    tx.securityEvent.updateMany({
      where: { orgMappingId: mappingId },
      data: { orgId: null, orgMappingId: null },
    }),
    tx.cloudUser.updateMany({
      where: { orgMappingId: mappingId },
      data: { orgId: null, orgMappingId: null },
    }),
  ]);
  return { tickets: t.count, securityEvents: se.count, cloudUsers: cu.count };
}

// Ensure all 4 OrgDomainAuth rows exist for an org (called lazily on profile view/creation).
export async function ensureDomainAuths(orgId: string, db: PrismaClient): Promise<void> {
  const domains = ["IDENTITY", "VULNERABILITY", "COMPLIANCE", "OPERATIONS"] as const;
  for (const domain of domains) {
    await db.orgDomainAuth.upsert({
      where: { orgId_domain: { orgId, domain } },
      create: { orgId, domain, status: "UNKNOWN" },
      update: {},
    });
  }
}

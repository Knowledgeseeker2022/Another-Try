-- Phase 3: Clients + Canonical Identity + Match Engine
-- Non-destructive. Migrates Organization.domain → domains[], adds segment,
-- adds OrgMatchSuggestion + OrgDomainAuth tables, adds matcherKey/wasAutoLinked
-- to OrgMapping, adds orgMappingId to ingested record tables.

-- ── Organization: domain String? → domains String[], add segment ─────────────

ALTER TABLE "Organization" ADD COLUMN "domains" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Organization" ADD COLUMN "segment" TEXT;

-- Migrate existing single domain into the array (non-destructive)
UPDATE "Organization" SET "domains" = ARRAY["domain"] WHERE "domain" IS NOT NULL;
ALTER TABLE "Organization" DROP COLUMN "domain";

-- ── OrgMapping: add matcherKey + wasAutoLinked ────────────────────────────────

ALTER TABLE "OrgMapping" ADD COLUMN "matcherKey" TEXT;
ALTER TABLE "OrgMapping" ADD COLUMN "wasAutoLinked" BOOLEAN NOT NULL DEFAULT false;

-- ── New enums ─────────────────────────────────────────────────────────────────

CREATE TYPE "OrgSuggestionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');
CREATE TYPE "DataDomain" AS ENUM ('IDENTITY', 'VULNERABILITY', 'COMPLIANCE', 'OPERATIONS');
CREATE TYPE "DomainAuthStatus" AS ENUM ('UNKNOWN', 'AUTHORIZED', 'NOT_AUTHORIZED');

-- ── OrgMatchSuggestion ───────────────────────────────────────────────────────

CREATE TABLE "OrgMatchSuggestion" (
    "id"            TEXT NOT NULL,
    "orgId"         TEXT NOT NULL,
    "serviceSlug"   TEXT NOT NULL,
    "externalId"    TEXT NOT NULL,
    "externalName"  TEXT,
    "confidence"    INTEGER NOT NULL,
    "matcherKey"    TEXT NOT NULL,
    "matchEvidence" JSONB,
    "status"        "OrgSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "orgMappingId"  TEXT,
    "reviewedById"  TEXT,
    "reviewedAt"    TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgMatchSuggestion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrgMatchSuggestion_serviceSlug_externalId_key"
    ON "OrgMatchSuggestion"("serviceSlug", "externalId");

CREATE UNIQUE INDEX "OrgMatchSuggestion_orgMappingId_key"
    ON "OrgMatchSuggestion"("orgMappingId");

CREATE INDEX "OrgMatchSuggestion_orgId_idx"    ON "OrgMatchSuggestion"("orgId");
CREATE INDEX "OrgMatchSuggestion_status_idx"   ON "OrgMatchSuggestion"("status");

ALTER TABLE "OrgMatchSuggestion"
    ADD CONSTRAINT "OrgMatchSuggestion_orgId_fkey"
        FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrgMatchSuggestion"
    ADD CONSTRAINT "OrgMatchSuggestion_reviewedById_fkey"
        FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrgMatchSuggestion"
    ADD CONSTRAINT "OrgMatchSuggestion_orgMappingId_fkey"
        FOREIGN KEY ("orgMappingId") REFERENCES "OrgMapping"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;

-- ── OrgDomainAuth ─────────────────────────────────────────────────────────────

CREATE TABLE "OrgDomainAuth" (
    "id"           TEXT NOT NULL,
    "orgId"        TEXT NOT NULL,
    "domain"       "DataDomain" NOT NULL,
    "status"       "DomainAuthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "authorizedAt" TIMESTAMP(3),
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgDomainAuth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrgDomainAuth_orgId_domain_key"
    ON "OrgDomainAuth"("orgId", "domain");

ALTER TABLE "OrgDomainAuth"
    ADD CONSTRAINT "OrgDomainAuth_orgId_fkey"
        FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed domain auth rows (UNKNOWN) for all existing orgs.
-- Uses gen_random_uuid() — available in PostgreSQL 13+.
INSERT INTO "OrgDomainAuth" ("id", "orgId", "domain", "status", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    o.id,
    d.domain::"DataDomain",
    'UNKNOWN'::"DomainAuthStatus",
    NOW(),
    NOW()
FROM "Organization" o
CROSS JOIN (VALUES
    ('IDENTITY'),
    ('VULNERABILITY'),
    ('COMPLIANCE'),
    ('OPERATIONS')
) AS d(domain)
ON CONFLICT DO NOTHING;

-- ── Ingested record tables: add orgMappingId ──────────────────────────────────

ALTER TABLE "Ticket"        ADD COLUMN "orgMappingId" TEXT;
ALTER TABLE "SecurityEvent" ADD COLUMN "orgMappingId" TEXT;
ALTER TABLE "CloudUser"     ADD COLUMN "orgMappingId" TEXT;

CREATE INDEX "Ticket_orgMappingId_idx"        ON "Ticket"("orgMappingId");
CREATE INDEX "SecurityEvent_orgMappingId_idx" ON "SecurityEvent"("orgMappingId");
CREATE INDEX "CloudUser_orgMappingId_idx"     ON "CloudUser"("orgMappingId");

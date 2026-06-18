-- Phase 2: multi-tenant SSO (SsoConfig → SsoTenant + SsoGroupMapping)
--
-- Non-destructive:
--   • Renames SsoConfig → SsoTenant (any existing row survives as the QCT tenant)
--   • Rows with NULL tenantId are deleted first (they cannot satisfy the new NOT NULL
--     UNIQUE constraint and are unsalvageable — tenantId IS the trust anchor)
--   • Adds name, orgId columns to SsoTenant
--   • Creates SsoGroupMapping table
--   • Adds ssoProvisioned + ssoTenantId columns to UserGroup

-- ── 1. Clean up any tenant-less SsoConfig rows ──────────────────────────────
DELETE FROM "SsoConfig" WHERE "tenantId" IS NULL;

-- ── 2. Rename SsoConfig → SsoTenant ─────────────────────────────────────────
ALTER TABLE "SsoConfig" RENAME TO "SsoTenant";

-- Rename the primary key constraint to match the new table name
ALTER TABLE "SsoTenant" RENAME CONSTRAINT "SsoConfig_pkey" TO "SsoTenant_pkey";

-- ── 3. Harden tenantId: NOT NULL + UNIQUE ────────────────────────────────────
ALTER TABLE "SsoTenant" ALTER COLUMN "tenantId" SET NOT NULL;
CREATE UNIQUE INDEX "SsoTenant_tenantId_key" ON "SsoTenant"("tenantId");

-- ── 4. Add new columns ────────────────────────────────────────────────────────
ALTER TABLE "SsoTenant"
  ADD COLUMN "name"   TEXT NOT NULL DEFAULT 'Default',
  ADD COLUMN "orgId"  TEXT;

-- Backfill: rename the single existing QCT tenant row if present
UPDATE "SsoTenant" SET "name" = 'QCT Internal', "isDefault" = true WHERE "isDefault" = true;

-- Drop the temporary DEFAULT so future INSERTs must supply a name
ALTER TABLE "SsoTenant" ALTER COLUMN "name" DROP DEFAULT;

-- FK from SsoTenant.orgId → Organization.id
ALTER TABLE "SsoTenant"
  ADD CONSTRAINT "SsoTenant_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── 5. Create SsoGroupMapping ─────────────────────────────────────────────────
CREATE TABLE "SsoGroupMapping" (
  "id"             TEXT NOT NULL,
  "ssoTenantId"    TEXT NOT NULL,
  "entraGroupId"   TEXT NOT NULL,
  "entraGroupName" TEXT,
  "groupId"        TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SsoGroupMapping_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SsoGroupMapping"
  ADD CONSTRAINT "SsoGroupMapping_ssoTenantId_fkey"
  FOREIGN KEY ("ssoTenantId") REFERENCES "SsoTenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SsoGroupMapping"
  ADD CONSTRAINT "SsoGroupMapping_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "Group"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "SsoGroupMapping_ssoTenantId_entraGroupId_key"
  ON "SsoGroupMapping"("ssoTenantId", "entraGroupId");

CREATE INDEX "SsoGroupMapping_groupId_idx" ON "SsoGroupMapping"("groupId");

-- ── 6. Extend UserGroup: SSO-provisioned membership tracking ─────────────────
ALTER TABLE "UserGroup"
  ADD COLUMN "ssoProvisioned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ssoTenantId"    TEXT;

CREATE INDEX "UserGroup_ssoTenantId_idx" ON "UserGroup"("ssoTenantId");

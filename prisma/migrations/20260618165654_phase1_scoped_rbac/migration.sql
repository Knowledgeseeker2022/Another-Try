-- Phase 1: scoped RBAC grants + session-revocation token version.
-- Grants (UserRole / GroupRole) move from a bare composite-PK join to a surrogate-id
-- row that carries optional scope: appId (null = all apps / Admin-wide) and an org
-- subset (scopeAllOrgs=true = every client org). Existing rows are backfilled as
-- global grants (appId NULL, scopeAllOrgs TRUE) so current assignments keep working.

-- ── User: token version for immediate JWT session revocation ──────────────────
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- ── UserRole → scoped grant (non-destructive id backfill) ─────────────────────
ALTER TABLE "UserRole" DROP CONSTRAINT "UserRole_pkey",
ADD COLUMN     "appId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id" TEXT,
ADD COLUMN     "scopeAllOrgs" BOOLEAN NOT NULL DEFAULT true;
UPDATE "UserRole" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;
ALTER TABLE "UserRole" ALTER COLUMN "id" SET NOT NULL,
ADD CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id");

-- ── GroupRole → scoped grant (non-destructive id backfill) ────────────────────
ALTER TABLE "GroupRole" DROP CONSTRAINT "GroupRole_pkey",
ADD COLUMN     "appId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id" TEXT,
ADD COLUMN     "scopeAllOrgs" BOOLEAN NOT NULL DEFAULT true;
UPDATE "GroupRole" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;
ALTER TABLE "GroupRole" ALTER COLUMN "id" SET NOT NULL,
ADD CONSTRAINT "GroupRole_pkey" PRIMARY KEY ("id");

-- ── Org / OrgGroup scope child tables ─────────────────────────────────────────
CREATE TABLE "UserRoleOrg" (
    "userRoleId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "UserRoleOrg_pkey" PRIMARY KEY ("userRoleId","orgId")
);

CREATE TABLE "UserRoleOrgGroup" (
    "userRoleId" TEXT NOT NULL,
    "orgGroupId" TEXT NOT NULL,

    CONSTRAINT "UserRoleOrgGroup_pkey" PRIMARY KEY ("userRoleId","orgGroupId")
);

CREATE TABLE "GroupRoleOrg" (
    "groupRoleId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "GroupRoleOrg_pkey" PRIMARY KEY ("groupRoleId","orgId")
);

CREATE TABLE "GroupRoleOrgGroup" (
    "groupRoleId" TEXT NOT NULL,
    "orgGroupId" TEXT NOT NULL,

    CONSTRAINT "GroupRoleOrgGroup_pkey" PRIMARY KEY ("groupRoleId","orgGroupId")
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX "UserRoleOrg_orgId_idx" ON "UserRoleOrg"("orgId");
CREATE INDEX "UserRoleOrgGroup_orgGroupId_idx" ON "UserRoleOrgGroup"("orgGroupId");
CREATE INDEX "GroupRoleOrg_orgId_idx" ON "GroupRoleOrg"("orgId");
CREATE INDEX "GroupRoleOrgGroup_orgGroupId_idx" ON "GroupRoleOrgGroup"("orgGroupId");
CREATE INDEX "GroupRole_groupId_idx" ON "GroupRole"("groupId");
CREATE INDEX "GroupRole_appId_idx" ON "GroupRole"("appId");
CREATE UNIQUE INDEX "GroupRole_groupId_roleId_appId_key" ON "GroupRole"("groupId", "roleId", "appId");
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");
CREATE INDEX "UserRole_appId_idx" ON "UserRole"("appId");
CREATE UNIQUE INDEX "UserRole_userId_roleId_appId_key" ON "UserRole"("userId", "roleId", "appId");

-- ── Foreign keys ──────────────────────────────────────────────────────────────
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRoleOrg" ADD CONSTRAINT "UserRoleOrg_userRoleId_fkey" FOREIGN KEY ("userRoleId") REFERENCES "UserRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRoleOrg" ADD CONSTRAINT "UserRoleOrg_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRoleOrgGroup" ADD CONSTRAINT "UserRoleOrgGroup_userRoleId_fkey" FOREIGN KEY ("userRoleId") REFERENCES "UserRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRoleOrgGroup" ADD CONSTRAINT "UserRoleOrgGroup_orgGroupId_fkey" FOREIGN KEY ("orgGroupId") REFERENCES "OrgGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupRole" ADD CONSTRAINT "GroupRole_appId_fkey" FOREIGN KEY ("appId") REFERENCES "App"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupRoleOrg" ADD CONSTRAINT "GroupRoleOrg_groupRoleId_fkey" FOREIGN KEY ("groupRoleId") REFERENCES "GroupRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupRoleOrg" ADD CONSTRAINT "GroupRoleOrg_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupRoleOrgGroup" ADD CONSTRAINT "GroupRoleOrgGroup_groupRoleId_fkey" FOREIGN KEY ("groupRoleId") REFERENCES "GroupRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupRoleOrgGroup" ADD CONSTRAINT "GroupRoleOrgGroup_orgGroupId_fkey" FOREIGN KEY ("orgGroupId") REFERENCES "OrgGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

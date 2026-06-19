-- Phase 4: Client Groups — rule-based membership, controlled segment list
-- Creates OrgGroupMode enum; adds mode/ruleAttribute/ruleValue to OrgGroup; drops criteria.

CREATE TYPE "OrgGroupMode" AS ENUM ('MANUAL', 'RULE_BASED');

ALTER TABLE "OrgGroup"
  ADD COLUMN "mode"          "OrgGroupMode" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "ruleAttribute" TEXT,
  ADD COLUMN "ruleValue"     TEXT;

-- criteria was never evaluated — drop it (no data worth preserving).
ALTER TABLE "OrgGroup" DROP COLUMN IF EXISTS "criteria";

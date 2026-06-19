-- Phase 5: service hardening + scheduled polling
-- Adds consecutive-failure counter for escalation and triggeredBy tag on sync log rows.

ALTER TABLE "Service" ADD COLUMN "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ServiceSyncLog" ADD COLUMN "triggeredBy" TEXT;

-- Repair schema drift from the quota/package rollout.
-- These objects were present in prisma/schema.prisma but were never represented
-- by a migration, so migrate deploy could report success while the app client
-- still queried columns that did not exist in production.

ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'lite';

ALTER TABLE "Workshop"
  ADD COLUMN IF NOT EXISTS "extraVinQuota" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "quota_usage" (
  "id" TEXT NOT NULL,
  "workshopId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quota_usage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quota_usage_workshopId_createdAt_idx"
  ON "quota_usage"("workshopId", "createdAt");

CREATE INDEX IF NOT EXISTS "quota_usage_createdAt_idx"
  ON "quota_usage"("createdAt");

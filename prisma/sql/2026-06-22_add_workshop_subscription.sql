-- Forward-only DDL for the SaaS subscription/onboarding fields on Workshop.
--
-- Context: the project's schema is kept in sync with `prisma db push` (the
-- migrations/ history is an incomplete baseline and cannot be replayed from
-- scratch). This file is the reviewable, deploy-ready artifact to apply the
-- same change to the production database on the VPS, e.g.:
--   psql "$DATABASE_URL" -f prisma/sql/2026-06-22_add_workshop_subscription.sql
-- (or simply `bun run db:push` against the prod DATABASE_URL).
--
-- Impact: ADDITIVE ONLY. New enum types + new columns with defaults. Existing
-- rows are backfilled with the defaults below (approved + active + pro), so all
-- previously-provisioned workshops keep full access. No data is modified or
-- dropped. Safe to run once; guarded with IF NOT EXISTS where possible.

-- 1) Enum types -------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "PlanTier" AS ENUM ('starter', 'pro', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkshopApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Columns ----------------------------------------------------------------
ALTER TABLE "Workshop"
  ADD COLUMN IF NOT EXISTS "planTier" "PlanTier" NOT NULL DEFAULT 'pro',
  ADD COLUMN IF NOT EXISTS "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "approvalStatus" "WorkshopApprovalStatus" NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS "trialStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);

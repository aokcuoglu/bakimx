-- Forward-only DDL: self-serve plan upgrade request fields on Workshop.
-- Apply on prod with: psql "$DATABASE_URL" -f prisma/sql/2026-06-22_add_plan_request.sql
-- (or `bun run db:push`). ADDITIVE ONLY — nullable columns, no data change.
-- Depends on the "PlanTier" enum created in 2026-06-22_add_workshop_subscription.sql.

ALTER TABLE "Workshop"
  ADD COLUMN IF NOT EXISTS "requestedPlanTier" "PlanTier",
  ADD COLUMN IF NOT EXISTS "planRequestedAt" TIMESTAMP(3);

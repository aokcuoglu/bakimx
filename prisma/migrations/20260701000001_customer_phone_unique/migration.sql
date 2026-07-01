-- A phone belongs to a single customer within a workshop.
--
-- Replaces the non-unique lookup index "Customer_workshopId_phone_idx" with a
-- UNIQUE index on ("workshopId", "phone"). The unique index also serves the
-- (workshopId, phone) lookups, so the old plain index is dropped as redundant.
--
-- PRE-FLIGHT GUARD: this migration ABORTS (Prisma wraps it in one transaction,
-- so the whole thing rolls back and NOTHING is applied) if any workshop still
-- has two customers sharing a phone. Resolve duplicates FIRST:
--     bunx tsx scripts/find-duplicate-phones.ts     -- lists every colliding group
-- Merge/retire the extras (or fix a mistyped phone) until it reports 0.
--
-- If a deploy leaves this migration in the failed state, clear it before retry:
--     npx --yes prisma@7.8.0 migrate resolve --rolled-back 20260701000001_customer_phone_unique
--     npx --yes prisma@7.8.0 migrate deploy

DO $$
DECLARE
  dup_groups integer;
BEGIN
  SELECT count(*) INTO dup_groups FROM (
    SELECT "workshopId", "phone"
    FROM "Customer"
    GROUP BY "workshopId", "phone"
    HAVING count(*) > 1
  ) d;
  IF dup_groups > 0 THEN
    RAISE EXCEPTION
      'Cannot add unique(workshopId, phone): % duplicate group(s) exist. Run "bunx tsx scripts/find-duplicate-phones.ts" and resolve them first.', dup_groups;
  END IF;
END $$;

-- DropIndex
DROP INDEX "Customer_workshopId_phone_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Customer_workshopId_phone_key" ON "Customer"("workshopId", "phone");

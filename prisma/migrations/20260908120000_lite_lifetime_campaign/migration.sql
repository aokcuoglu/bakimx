-- Idempotent backfill: only current Lite workshops with no paid billing evidence.
ALTER TABLE "Workshop" ADD COLUMN IF NOT EXISTS "liteFreeGrantedAt" TIMESTAMP(3);
UPDATE "Workshop" w
SET "liteFreeGrantedAt" = w."createdAt", "trialStartedAt" = NULL,
    "trialEndsAt" = NULL, "currentPeriodEnd" = NULL, "subscriptionStatus" = 'active'
WHERE w."planTier" = 'lite' AND w."kind" = 'customer' AND w."liteFreeGrantedAt" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "BillingOrder" b WHERE b."workshopId" = w.id
    AND b."amountMinor" > 0 AND b.status IN ('confirmed', 'pending_payment'))
  AND NOT EXISTS (SELECT 1 FROM "PaymentTransaction" p WHERE p."workshopId" = w.id
    AND p."amountMinor" > 0 AND p.purpose = 'purchase'
    AND p.status IN ('initiated', 'callback_received', 'completed'));

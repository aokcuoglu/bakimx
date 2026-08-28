-- Paket değişimi artık gerçek yükseltme ile düşürmeyi ayırır. Bu ayrım ödeme
-- tutarını veya plan aktivasyonunu değiştirmez; hakediş uygunluğunu belirler.
ALTER TYPE "BillingOrderType" ADD VALUE IF NOT EXISTS 'downgrade' BEFORE 'renewal';

-- Sipariş tutarının KDV anlık görüntüsü. amountMinor mevcut KDV-dahil sözleşme
-- olarak korunur; grossAmountMinor aynı brüt değeri açık isimle tekrarlar.
ALTER TABLE "BillingOrder"
  ADD COLUMN "previousPlanTier" "PlanTier",
  ADD COLUMN "vatRateBps" INTEGER,
  ADD COLUMN "grossAmountMinor" INTEGER,
  ADD COLUMN "netAmountMinor" INTEGER;

-- Eski siparişler için onaylanan ticari varsayım: fiyatlar %20 KDV dahildir.
-- Numeric ROUND kullanımı kuruş yarımlarını deterministik biçimde yuvarlar.
UPDATE "BillingOrder"
SET
  "vatRateBps" = 2000,
  "grossAmountMinor" = "amountMinor",
  "netAmountMinor" = ROUND("amountMinor"::numeric * 10000 / 12000)::integer;

ALTER TABLE "BillingOrder"
  ALTER COLUMN "vatRateBps" SET NOT NULL,
  ALTER COLUMN "vatRateBps" SET DEFAULT 2000,
  ALTER COLUMN "grossAmountMinor" SET NOT NULL,
  ALTER COLUMN "netAmountMinor" SET NOT NULL;

-- Deploy migration'ı yeni ECS task'larından önce çalışır. O kısa pencerede eski
-- uygulama bu yeni alanları göndermeden sipariş açarsa insert kırılmasın ve boş
-- snapshot kalmasın: DB aynı %20 varsayımıyla alanları doldurur. Yeni kod tüm
-- değerleri açıkça gönderir; tetikleyici yalnız eksik alanları tamamlar.
CREATE FUNCTION "fill_billing_order_tax_snapshot"() RETURNS trigger AS $$
BEGIN
  IF NEW."vatRateBps" IS NULL THEN
    NEW."vatRateBps" := 2000;
  END IF;
  IF NEW."grossAmountMinor" IS NULL THEN
    NEW."grossAmountMinor" := NEW."amountMinor";
  END IF;
  IF NEW."netAmountMinor" IS NULL THEN
    NEW."netAmountMinor" := ROUND(NEW."grossAmountMinor"::numeric * 10000 / (10000 + NEW."vatRateBps"))::integer;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "BillingOrder_fill_tax_snapshot"
BEFORE INSERT ON "BillingOrder"
FOR EACH ROW EXECUTE FUNCTION "fill_billing_order_tax_snapshot"();

ALTER TABLE "BillingOrder"
  ADD CONSTRAINT "BillingOrder_vatRateBps_check" CHECK ("vatRateBps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "BillingOrder_grossAmountMinor_check" CHECK ("grossAmountMinor" >= 0),
  ADD CONSTRAINT "BillingOrder_netAmountMinor_check" CHECK ("netAmountMinor" >= 0 AND "netAmountMinor" <= "grossAmountMinor"),
  ADD CONSTRAINT "BillingOrder_amount_snapshot_match_check" CHECK ("amountMinor" = "grossAmountMinor");

CREATE TYPE "SalesCommissionReviewReason" AS ENUM ('missing_rule', 'legacy_manual');

-- Kurallar append-only'dir. Yeni kural eklenirken uygulama bir önceki satırın
-- effectiveTo alanını kapatır; geçmiş oran/başlangıç değerleri değişmez ve satırlar silinmez.
CREATE TABLE "SalesCommissionRule" (
  "id" TEXT NOT NULL,
  "planTier" "PlanTier" NOT NULL,
  "billingCycle" "BillingCycle" NOT NULL,
  "rateBps" INTEGER NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SalesCommissionRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalesCommissionRule_rateBps_check" CHECK ("rateBps" BETWEEN 0 AND 10000),
  CONSTRAINT "SalesCommissionRule_effective_range_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE UNIQUE INDEX "SalesCommissionRule_planTier_billingCycle_effectiveFrom_key"
  ON "SalesCommissionRule"("planTier", "billingCycle", "effectiveFrom");
CREATE INDEX "SalesCommissionRule_planTier_billingCycle_effectiveFrom_idx"
  ON "SalesCommissionRule"("planTier", "billingCycle", "effectiveFrom");
CREATE INDEX "SalesCommissionRule_createdById_idx" ON "SalesCommissionRule"("createdById");

ALTER TABLE "SalesCommissionRule"
  ADD CONSTRAINT "SalesCommissionRule_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Mevcut amountMinor sütunu approvedAmountMinor adıyla Prisma'ya map edilir;
-- fiziksel kolon ve eski manuel değerler aynen kalır.
ALTER TABLE "SalesCommission"
  ADD COLUMN "ruleId" TEXT,
  ADD COLUMN "calculationBaseMinor" INTEGER,
  ADD COLUMN "calculationRateBps" INTEGER,
  ADD COLUMN "calculatedAmountMinor" INTEGER,
  ADD COLUMN "reviewReason" "SalesCommissionReviewReason",
  ADD COLUMN "adjustmentReason" TEXT,
  ADD COLUMN "voidedAt" TIMESTAMP(3);

UPDATE "SalesCommission"
SET "reviewReason" = 'legacy_manual'
WHERE "reviewReason" IS NULL;

ALTER TABLE "SalesCommission"
  ADD CONSTRAINT "SalesCommission_ruleId_fkey"
  FOREIGN KEY ("ruleId") REFERENCES "SalesCommissionRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SalesCommission_calculationBaseMinor_check" CHECK ("calculationBaseMinor" IS NULL OR "calculationBaseMinor" >= 0),
  ADD CONSTRAINT "SalesCommission_calculationRateBps_check" CHECK ("calculationRateBps" IS NULL OR "calculationRateBps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "SalesCommission_calculatedAmountMinor_check" CHECK ("calculatedAmountMinor" IS NULL OR "calculatedAmountMinor" >= 0),
  ADD CONSTRAINT "SalesCommission_amountMinor_check" CHECK ("amountMinor" IS NULL OR "amountMinor" >= 0);

CREATE INDEX "SalesCommission_ruleId_idx" ON "SalesCommission"("ruleId");

CREATE TABLE "SalesCommissionEvent" (
  "id" TEXT NOT NULL,
  "commissionId" TEXT NOT NULL,
  "fromStatus" "SalesCommissionStatus",
  "toStatus" "SalesCommissionStatus" NOT NULL,
  "actorId" TEXT,
  "actorLabel" TEXT NOT NULL,
  "amountMinor" INTEGER,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SalesCommissionEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalesCommissionEvent_amountMinor_check" CHECK ("amountMinor" IS NULL OR "amountMinor" >= 0)
);

CREATE INDEX "SalesCommissionEvent_commissionId_createdAt_idx"
  ON "SalesCommissionEvent"("commissionId", "createdAt");
CREATE INDEX "SalesCommissionEvent_actorId_idx" ON "SalesCommissionEvent"("actorId");

ALTER TABLE "SalesCommissionEvent"
  ADD CONSTRAINT "SalesCommissionEvent_commissionId_fkey"
  FOREIGN KEY ("commissionId") REFERENCES "SalesCommission"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SalesCommissionEvent_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Eski ledger satırlarının bilinmeyen geçmişini uydurmayız; yalnız migration
-- anındaki durumlarını legacy_backfill aktörüyle başlangıç olayı olarak kaydederiz.
INSERT INTO "SalesCommissionEvent" (
  "id", "commissionId", "fromStatus", "toStatus", "actorId", "actorLabel", "amountMinor", "reason", "createdAt"
)
SELECT
  'legacy-event-' || "id",
  "id",
  NULL,
  "status",
  NULL,
  'legacy_backfill',
  "amountMinor",
  'Mevcut manuel hakediş migration sırasında değiştirilmeden devralındı.',
  "createdAt"
FROM "SalesCommission";

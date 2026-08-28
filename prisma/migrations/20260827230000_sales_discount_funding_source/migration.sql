-- CreateEnum
CREATE TYPE "SalesDiscountFundingSource" AS ENUM ('advisor_margin', 'bakimx_funded');

-- AlterTable: add nullable columns first so existing rows can be classified safely.
ALTER TABLE "SalesDiscountCode"
ADD COLUMN "fundingSource" "SalesDiscountFundingSource",
ADD COLUMN "createdByUserId" TEXT;

-- Existing advisor-owned codes keep their original economic meaning. Codes that
-- were created from the admin surface without an advisor are treated as legacy
-- BakımX-funded codes; they remain admin-visible until explicitly assigned.
UPDATE "SalesDiscountCode"
SET "fundingSource" = CASE
  WHEN "advisorId" IS NULL THEN 'bakimx_funded'::"SalesDiscountFundingSource"
  ELSE 'advisor_margin'::"SalesDiscountFundingSource"
END;

-- For legacy advisor codes the actor can be recovered from the advisor profile.
-- Legacy platform codes have no reliable actor snapshot and intentionally stay NULL.
UPDATE "SalesDiscountCode" AS code
SET "createdByUserId" = advisor."userId"
FROM "SalesAdvisor" AS advisor
WHERE code."advisorId" = advisor."id";

ALTER TABLE "SalesDiscountCode"
ALTER COLUMN "fundingSource" SET NOT NULL,
ALTER COLUMN "fundingSource" SET DEFAULT 'advisor_margin';

-- CreateIndex
CREATE INDEX "SalesDiscountCode_fundingSource_createdAt_idx"
ON "SalesDiscountCode"("fundingSource", "createdAt");

-- CreateIndex
CREATE INDEX "SalesDiscountCode_createdByUserId_idx"
ON "SalesDiscountCode"("createdByUserId");

-- AddForeignKey
ALTER TABLE "SalesDiscountCode"
ADD CONSTRAINT "SalesDiscountCode_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

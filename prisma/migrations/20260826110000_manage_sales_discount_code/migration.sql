ALTER TABLE "SalesDiscountCode" ADD COLUMN "disabledAt" TIMESTAMP(3);

CREATE INDEX "SalesDiscountCode_disabledAt_idx" ON "SalesDiscountCode"("disabledAt");

-- CreateTable
CREATE TABLE "SalesDiscountCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "advisorId" TEXT,
    "leadId" TEXT,
    "workshopId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesDiscountCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesDiscountCode_code_key" ON "SalesDiscountCode"("code");

-- CreateIndex
CREATE INDEX "SalesDiscountCode_advisorId_createdAt_idx" ON "SalesDiscountCode"("advisorId", "createdAt");

-- CreateIndex
CREATE INDEX "SalesDiscountCode_expiresAt_idx" ON "SalesDiscountCode"("expiresAt");

-- AddForeignKey
ALTER TABLE "SalesDiscountCode" ADD CONSTRAINT "SalesDiscountCode_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "SalesAdvisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDiscountCode" ADD CONSTRAINT "SalesDiscountCode_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDiscountCode" ADD CONSTRAINT "SalesDiscountCode_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'yearly');

-- CreateEnum
CREATE TYPE "BillingOrderType" AS ENUM ('new_purchase', 'upgrade', 'renewal');

-- CreateEnum
CREATE TYPE "BillingOrderStatus" AS ENUM ('pending_payment', 'confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "BillingMethod" AS ENUM ('havale', 'manual', 'card');

-- AlterTable
ALTER TABLE "Workshop" ADD COLUMN     "billingCycle" "BillingCycle",
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BillingOrder" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "type" "BillingOrderType" NOT NULL,
    "planTier" "PlanTier" NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" "BillingOrderStatus" NOT NULL DEFAULT 'pending_payment',
    "method" "BillingMethod" NOT NULL DEFAULT 'havale',
    "reference" TEXT NOT NULL,
    "billingSnapshot" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByEmail" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),

    CONSTRAINT "BillingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingOrder_reference_key" ON "BillingOrder"("reference");

-- CreateIndex
CREATE INDEX "BillingOrder_workshopId_idx" ON "BillingOrder"("workshopId");

-- CreateIndex
CREATE INDEX "BillingOrder_status_idx" ON "BillingOrder"("status");

-- AddForeignKey
ALTER TABLE "BillingOrder" ADD CONSTRAINT "BillingOrder_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Add payment fields to ServiceOrder
ALTER TABLE "ServiceOrder" ADD COLUMN "paidAmount" DOUBLE PRECISION;
ALTER TABLE "ServiceOrder" ADD COLUMN "remainingAmount" DOUBLE PRECISION;
ALTER TABLE "ServiceOrder" ADD COLUMN "lastPaymentAt" TIMESTAMP(3);

-- CreateEnum: Add overpaid to PaymentStatus
-- PostgreSQL: ALTER TYPE "PaymentStatus" ADD VALUE 'overpaid';
-- Note: This must be run separately if the enum already exists with data.
-- For a fresh database, the enum is created with all values including 'overpaid'.
-- For an existing database, run: ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'overpaid';

-- CreateEnum: PaymentMethod
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'credit_card', 'bank_transfer', 'other');

-- CreateEnum: CollectionStatus
CREATE TYPE "CollectionStatus" AS ENUM ('completed', 'cancelled', 'refunded');

-- CreateTable: CollectionPayment
CREATE TABLE "CollectionPayment" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceOrderId" TEXT,
    "quoteId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "method" "PaymentMethod" NOT NULL DEFAULT 'cash',
    "status" "CollectionStatus" NOT NULL DEFAULT 'completed',
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceNo" TEXT,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: CollectionPayment indexes
CREATE INDEX "CollectionPayment_workshopId_idx" ON "CollectionPayment"("workshopId");
CREATE INDEX "CollectionPayment_customerId_idx" ON "CollectionPayment"("customerId");
CREATE INDEX "CollectionPayment_serviceOrderId_idx" ON "CollectionPayment"("serviceOrderId");
CREATE INDEX "CollectionPayment_paymentDate_idx" ON "CollectionPayment"("paymentDate");
CREATE INDEX "CollectionPayment_method_idx" ON "CollectionPayment"("method");
CREATE INDEX "CollectionPayment_status_idx" ON "CollectionPayment"("status");

-- AddForeignKey: CollectionPayment -> Workshop
ALTER TABLE "CollectionPayment" ADD CONSTRAINT "CollectionPayment_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CollectionPayment -> Customer
ALTER TABLE "CollectionPayment" ADD CONSTRAINT "CollectionPayment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CollectionPayment -> ServiceOrder
ALTER TABLE "CollectionPayment" ADD CONSTRAINT "CollectionPayment_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterEnum: Add overpaid to PaymentStatus
-- Run this separately for existing databases:
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'overpaid';
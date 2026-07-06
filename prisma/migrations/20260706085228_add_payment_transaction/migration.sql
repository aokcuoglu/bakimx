-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('initiated', 'callback_received', 'completed', 'failed', 'expired');

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "billingOrderId" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'tami',
    "providerOrderId" TEXT NOT NULL,
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'initiated',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "maskedPan" TEXT,
    "cardBrand" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "correlationId" TEXT,
    "callbackPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_providerOrderId_key" ON "PaymentTransaction"("providerOrderId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_billingOrderId_idx" ON "PaymentTransaction"("billingOrderId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_workshopId_createdAt_idx" ON "PaymentTransaction"("workshopId", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_billingOrderId_fkey" FOREIGN KEY ("billingOrderId") REFERENCES "BillingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

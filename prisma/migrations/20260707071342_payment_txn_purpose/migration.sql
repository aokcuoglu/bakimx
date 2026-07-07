-- CreateEnum
CREATE TYPE "PaymentTransactionPurpose" AS ENUM ('purchase', 'card_verification');

-- DropForeignKey
ALTER TABLE "PaymentTransaction" DROP CONSTRAINT "PaymentTransaction_billingOrderId_fkey";

-- AlterTable
ALTER TABLE "PaymentTransaction" ADD COLUMN     "purpose" "PaymentTransactionPurpose" NOT NULL DEFAULT 'purchase',
ALTER COLUMN "billingOrderId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_billingOrderId_fkey" FOREIGN KEY ("billingOrderId") REFERENCES "BillingOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

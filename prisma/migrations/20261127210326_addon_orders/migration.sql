-- AlterEnum
ALTER TYPE "BillingOrderType" ADD VALUE 'addon';

-- AlterTable
ALTER TABLE "BillingOrder" ADD COLUMN     "addonLines" JSONB;

-- AlterTable
ALTER TABLE "Workshop" ADD COLUMN     "paidAddons" TEXT[] DEFAULT ARRAY[]::TEXT[];

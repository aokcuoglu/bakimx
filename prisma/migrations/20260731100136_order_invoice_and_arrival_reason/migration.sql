-- CreateEnum
CREATE TYPE "ArrivalReason" AS ENUM ('fault', 'damage', 'maintenance', 'inspection', 'accessory');

-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN     "arrivalReason" "ArrivalReason",
ADD COLUMN     "invoiceDate" TIMESTAMP(3),
ADD COLUMN     "invoiceNo" TEXT;

-- AlterEnum
ALTER TYPE "PartsRequestStatus" ADD VALUE 'cancelled';

-- AlterTable
ALTER TABLE "PartsRequest" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3);

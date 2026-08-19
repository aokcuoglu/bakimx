-- CreateEnum
CREATE TYPE "PartsRequestType" AS ENUM ('part', 'external_labor');

-- AlterTable
-- Additive: DEFAULT 'part' sayesinde mevcut talepler backfill'siz doğru tipte
-- kalır, eski kod da yeni kolonları görmeden çalışmaya devam eder.
ALTER TABLE "PartsRequest" ADD COLUMN     "type" "PartsRequestType" NOT NULL DEFAULT 'part',
ADD COLUMN     "estimatedPriceKurus" INTEGER,
ADD COLUMN     "supplierName" TEXT;

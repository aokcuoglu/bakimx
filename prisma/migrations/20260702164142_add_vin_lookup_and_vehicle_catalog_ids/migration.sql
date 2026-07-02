-- CreateEnum
CREATE TYPE "VinLookupStatus" AS ENUM ('found', 'not_found');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "catalogBrandId" INTEGER,
ADD COLUMN     "catalogModelId" INTEGER,
ADD COLUMN     "catalogVehicleTypeId" INTEGER;

-- CreateTable
CREATE TABLE "vin_lookups" (
    "vin" TEXT NOT NULL,
    "status" "VinLookupStatus" NOT NULL,
    "provider" TEXT NOT NULL,
    "rawResponse" JSONB,
    "hitCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vin_lookups_pkey" PRIMARY KEY ("vin")
);

-- CreateIndex
CREATE INDEX "vin_lookups_createdAt_idx" ON "vin_lookups"("createdAt");

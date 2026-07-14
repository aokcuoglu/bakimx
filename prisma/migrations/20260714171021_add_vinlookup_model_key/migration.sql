-- AlterTable
ALTER TABLE "vin_lookups" ADD COLUMN     "modelKey" TEXT;

-- CreateIndex
CREATE INDEX "vin_lookups_modelKey_idx" ON "vin_lookups"("modelKey");

-- Backfill: mevcut satırların önekini VIN'in ilk 9 hanesinden doldur.
UPDATE "vin_lookups" SET "modelKey" = substring("vin" from 1 for 9);

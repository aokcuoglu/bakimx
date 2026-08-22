-- AlterEnum
ALTER TYPE "OrderItemSource" ADD VALUE 'getirbakim';

-- AlterTable
ALTER TABLE "ServiceOrderItem" ADD COLUMN     "getirbakimProductId" TEXT;

-- AlterTable
ALTER TABLE "QuoteItem" ADD COLUMN     "getirbakimProductId" TEXT;

-- CreateIndex
CREATE INDEX "ServiceOrderItem_getirbakimProductId_idx" ON "ServiceOrderItem"("getirbakimProductId");

-- CreateIndex
CREATE INDEX "QuoteItem_getirbakimProductId_idx" ON "QuoteItem"("getirbakimProductId");

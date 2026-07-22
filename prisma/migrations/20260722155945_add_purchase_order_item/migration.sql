-- AlterEnum
ALTER TYPE "OrderItemSource" ADD VALUE 'purchase';

-- AlterTable
ALTER TABLE "ServiceOrderItem" ADD COLUMN     "purchasePriceKurus" INTEGER,
ADD COLUMN     "purchasedAt" TIMESTAMP(3),
ADD COLUMN     "purchasedById" TEXT,
ADD COLUMN     "supplierId" TEXT,
ADD COLUMN     "supplierName" TEXT;

-- AlterTable
ALTER TABLE "VehiclePhoto" ADD COLUMN     "serviceOrderItemId" TEXT;

-- CreateIndex
CREATE INDEX "ServiceOrderItem_workshopId_source_idx" ON "ServiceOrderItem"("workshopId", "source");

-- CreateIndex
CREATE INDEX "ServiceOrderItem_supplierId_idx" ON "ServiceOrderItem"("supplierId");

-- CreateIndex
CREATE INDEX "VehiclePhoto_serviceOrderItemId_idx" ON "VehiclePhoto"("serviceOrderItemId");

-- AddForeignKey
ALTER TABLE "VehiclePhoto" ADD CONSTRAINT "VehiclePhoto_serviceOrderItemId_fkey" FOREIGN KEY ("serviceOrderItemId") REFERENCES "ServiceOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderItem" ADD CONSTRAINT "ServiceOrderItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderItem" ADD CONSTRAINT "ServiceOrderItem_purchasedById_fkey" FOREIGN KEY ("purchasedById") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

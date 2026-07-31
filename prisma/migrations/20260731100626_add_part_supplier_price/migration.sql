-- CreateTable
CREATE TABLE "PartSupplierPrice" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchasePrice" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "supplierSku" TEXT,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartSupplierPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartSupplierPrice_workshopId_idx" ON "PartSupplierPrice"("workshopId");

-- CreateIndex
CREATE INDEX "PartSupplierPrice_partId_idx" ON "PartSupplierPrice"("partId");

-- CreateIndex
CREATE INDEX "PartSupplierPrice_supplierId_idx" ON "PartSupplierPrice"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PartSupplierPrice_partId_supplierId_key" ON "PartSupplierPrice"("partId", "supplierId");

-- AddForeignKey
ALTER TABLE "PartSupplierPrice" ADD CONSTRAINT "PartSupplierPrice_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartSupplierPrice" ADD CONSTRAINT "PartSupplierPrice_partId_fkey" FOREIGN KEY ("partId") REFERENCES "PartStockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartSupplierPrice" ADD CONSTRAINT "PartSupplierPrice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: mevcut tekil tedarikçi + alış fiyatı olan parçalar için varsayılan satır üret
INSERT INTO "PartSupplierPrice" ("id", "workshopId", "partId", "supplierId", "purchasePrice", "currency", "isPreferred", "createdAt", "updatedAt")
SELECT
  replace(gen_random_uuid()::text, '-', ''),
  p."workshopId",
  p."id",
  p."supplierId",
  p."purchasePrice",
  p."currency",
  true,
  NOW(),
  NOW()
FROM "PartStockItem" p
WHERE p."supplierId" IS NOT NULL
  AND p."purchasePrice" IS NOT NULL
ON CONFLICT ("partId", "supplierId") DO NOTHING;

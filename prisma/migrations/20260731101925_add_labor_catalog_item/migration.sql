-- CreateTable
CREATE TABLE "LaborCatalogItem" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "defaultPriceKurus" INTEGER,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaborCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LaborCatalogItem_workshopId_isActive_idx" ON "LaborCatalogItem"("workshopId", "isActive");

-- CreateIndex
CREATE INDEX "LaborCatalogItem_workshopId_name_idx" ON "LaborCatalogItem"("workshopId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "LaborCatalogItem_workshopId_code_key" ON "LaborCatalogItem"("workshopId", "code");

-- AddForeignKey
ALTER TABLE "LaborCatalogItem" ADD CONSTRAINT "LaborCatalogItem_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

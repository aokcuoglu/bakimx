/*
  Warnings:

  - A unique constraint covering the columns `[workshopId,name]` on the table `LaborCatalogItem` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "LaborCatalogItem_workshopId_name_key" ON "LaborCatalogItem"("workshopId", "name");

/*
  Warnings:

  - A unique constraint covering the columns `[serviceOrderId,templateKey]` on the table `ChecklistItem` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ChecklistItem_serviceOrderId_templateKey_idx";

-- AlterTable
ALTER TABLE "PartsRequest" ADD COLUMN     "convertedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_serviceOrderId_templateKey_key" ON "ChecklistItem"("serviceOrderId", "templateKey");

-- AlterTable
ALTER TABLE "ChecklistItem" ADD COLUMN     "isRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "templateKey" TEXT;

-- AlterTable
ALTER TABLE "PartsRequest" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "tecdocArticleId" INTEGER;

-- AlterTable
ALTER TABLE "ServiceOrderItem" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedById" TEXT,
ADD COLUMN     "completionNote" TEXT;

-- CreateIndex
CREATE INDEX "ChecklistItem_serviceOrderId_templateKey_idx" ON "ChecklistItem"("serviceOrderId", "templateKey");

-- CreateIndex
CREATE INDEX "ServiceOrderItem_serviceOrderId_completedAt_idx" ON "ServiceOrderItem"("serviceOrderId", "completedAt");

-- AddForeignKey
ALTER TABLE "ServiceOrderItem" ADD CONSTRAINT "ServiceOrderItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

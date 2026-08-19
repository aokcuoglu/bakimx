-- BAK-98: şikayet ↔ kiracı bağı, atama ve iç not.
-- Üç sütun da NULLABLE ve varsayılansız: mevcut satırlar olduğu gibi kalır,
-- geri alma tek adımdır (DROP COLUMN).

-- AlterTable
ALTER TABLE "SupportRequest" ADD COLUMN     "workshopId" TEXT,
ADD COLUMN     "assignedToUserId" TEXT,
ADD COLUMN     "internalNote" TEXT;

-- CreateIndex
CREATE INDEX "SupportRequest_workshopId_idx" ON "SupportRequest"("workshopId");

-- CreateIndex
CREATE INDEX "SupportRequest_assignedToUserId_idx" ON "SupportRequest"("assignedToUserId");

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

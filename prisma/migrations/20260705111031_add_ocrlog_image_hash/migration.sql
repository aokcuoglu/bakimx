-- AlterTable
ALTER TABLE "OcrLog" ADD COLUMN "imageHash" TEXT;

-- CreateIndex
CREATE INDEX "OcrLog_workshopId_imageHash_idx" ON "OcrLog"("workshopId", "imageHash");

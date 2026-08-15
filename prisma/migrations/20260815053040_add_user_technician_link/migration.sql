-- AlterTable
ALTER TABLE "User" ADD COLUMN     "technicianId" TEXT;

-- CreateIndex
CREATE INDEX "User_technicianId_idx" ON "User"("technicianId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;

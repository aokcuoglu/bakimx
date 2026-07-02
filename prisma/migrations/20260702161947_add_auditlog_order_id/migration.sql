-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "orderId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_orderId_idx" ON "AuditLog"("orderId");

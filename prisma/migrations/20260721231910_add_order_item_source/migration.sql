-- CreateEnum
CREATE TYPE "OrderItemSource" AS ENUM ('catalog', 'manual');

-- AlterTable
ALTER TABLE "ServiceOrderItem" ADD COLUMN     "source" "OrderItemSource";

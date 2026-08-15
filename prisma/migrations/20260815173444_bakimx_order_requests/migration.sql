-- CreateEnum
CREATE TYPE "BakimxOrderStatus" AS ENUM ('requested', 'confirmed', 'shipped', 'cancelled');

-- CreateTable
CREATE TABLE "bakimx_orders" (
    "id" TEXT NOT NULL,
    "workshop_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "status" "BakimxOrderStatus" NOT NULL DEFAULT 'requested',
    "note" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "shipped_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bakimx_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bakimx_order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "bakimx_product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_kurus" INTEGER NOT NULL,
    "list_price_kurus" INTEGER NOT NULL,
    "discount_bps" INTEGER NOT NULL,
    "name_snapshot" TEXT NOT NULL,
    "sku_snapshot" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bakimx_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bakimx_orders_workshop_id_status_idx" ON "bakimx_orders"("workshop_id", "status");

-- CreateIndex
CREATE INDEX "bakimx_orders_status_created_at_idx" ON "bakimx_orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "bakimx_order_items_order_id_idx" ON "bakimx_order_items"("order_id");

-- CreateIndex
CREATE INDEX "bakimx_order_items_bakimx_product_id_idx" ON "bakimx_order_items"("bakimx_product_id");

-- AddForeignKey
ALTER TABLE "bakimx_orders" ADD CONSTRAINT "bakimx_orders_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "Workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakimx_order_items" ADD CONSTRAINT "bakimx_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "bakimx_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

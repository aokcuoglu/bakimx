-- CreateEnum
CREATE TYPE "BakimxFitmentScope" AS ENUM ('universal', 'vehicle_linked');

-- CreateEnum
CREATE TYPE "BakimxImportMode" AS ENUM ('upsert', 'price_stock_only');

-- CreateEnum
CREATE TYPE "BakimxImportStatus" AS ENUM ('pending', 'previewed', 'applied', 'failed', 'cancelled');

-- AlterEnum
ALTER TYPE "OrderItemSource" ADD VALUE 'bakimx';

-- AlterTable
ALTER TABLE "QuoteItem" ADD COLUMN     "bakimxProductId" TEXT;

-- AlterTable
ALTER TABLE "ServiceOrderItem" ADD COLUMN     "bakimxProductId" TEXT;

-- CreateTable
CREATE TABLE "bakimx_product_brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bakimx_product_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bakimx_products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "brand_name" TEXT NOT NULL,
    "category_key" TEXT,
    "tecdoc_category_id" INTEGER,
    "oem_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "barcode" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'adet',
    "description" TEXT,
    "image_url" TEXT,
    "specs_json" JSONB,
    "search_key" TEXT NOT NULL,
    "workshop_price_kurus" INTEGER NOT NULL,
    "vat_rate_bps" INTEGER NOT NULL DEFAULT 2000,
    "cost_price_kurus" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "low_stock_qty" INTEGER NOT NULL DEFAULT 0,
    "backorderable" BOOLEAN NOT NULL DEFAULT false,
    "lead_time_days" INTEGER,
    "fitment_scope" "BakimxFitmentScope" NOT NULL DEFAULT 'universal',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "published_at" TIMESTAMP(3),
    "last_import_id" TEXT,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bakimx_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bakimx_product_fitments" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "vehicle_type_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bakimx_product_fitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bakimx_product_imports" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT,
    "file_name" TEXT NOT NULL,
    "file_key" TEXT,
    "mode" "BakimxImportMode" NOT NULL DEFAULT 'upsert',
    "status" "BakimxImportStatus" NOT NULL DEFAULT 'pending',
    "prices_include_vat" BOOLEAN NOT NULL DEFAULT false,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "errors_json" JSONB,
    "created_by_user_id" TEXT NOT NULL,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bakimx_product_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bakimx_catalog_audit" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bakimx_catalog_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bakimx_product_brands_name_key" ON "bakimx_product_brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "bakimx_product_brands_slug_key" ON "bakimx_product_brands"("slug");

-- CreateIndex
CREATE INDEX "bakimx_product_brands_is_active_idx" ON "bakimx_product_brands"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "bakimx_products_sku_key" ON "bakimx_products"("sku");

-- CreateIndex
CREATE INDEX "bakimx_products_brand_id_idx" ON "bakimx_products"("brand_id");

-- CreateIndex
CREATE INDEX "bakimx_products_is_active_fitment_scope_idx" ON "bakimx_products"("is_active", "fitment_scope");

-- CreateIndex
CREATE INDEX "bakimx_products_category_key_idx" ON "bakimx_products"("category_key");

-- CreateIndex
CREATE INDEX "bakimx_products_barcode_idx" ON "bakimx_products"("barcode");

-- CreateIndex
CREATE INDEX "bakimx_products_search_key_idx" ON "bakimx_products"("search_key");

-- CreateIndex
CREATE INDEX "bakimx_products_last_import_id_idx" ON "bakimx_products"("last_import_id");

-- CreateIndex
CREATE INDEX "bakimx_product_fitments_vehicle_type_id_idx" ON "bakimx_product_fitments"("vehicle_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "bakimx_product_fitments_product_id_vehicle_type_id_key" ON "bakimx_product_fitments"("product_id", "vehicle_type_id");

-- CreateIndex
CREATE INDEX "bakimx_product_imports_brand_id_idx" ON "bakimx_product_imports"("brand_id");

-- CreateIndex
CREATE INDEX "bakimx_product_imports_status_idx" ON "bakimx_product_imports"("status");

-- CreateIndex
CREATE INDEX "bakimx_product_imports_created_at_idx" ON "bakimx_product_imports"("created_at");

-- CreateIndex
CREATE INDEX "bakimx_catalog_audit_entity_type_entity_id_idx" ON "bakimx_catalog_audit"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "bakimx_catalog_audit_actor_user_id_idx" ON "bakimx_catalog_audit"("actor_user_id");

-- CreateIndex
CREATE INDEX "bakimx_catalog_audit_created_at_idx" ON "bakimx_catalog_audit"("created_at");

-- CreateIndex
CREATE INDEX "QuoteItem_bakimxProductId_idx" ON "QuoteItem"("bakimxProductId");

-- CreateIndex
CREATE INDEX "ServiceOrderItem_bakimxProductId_idx" ON "ServiceOrderItem"("bakimxProductId");

-- AddForeignKey
ALTER TABLE "bakimx_products" ADD CONSTRAINT "bakimx_products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "bakimx_product_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakimx_product_fitments" ADD CONSTRAINT "bakimx_product_fitments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "bakimx_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bakimx_product_imports" ADD CONSTRAINT "bakimx_product_imports_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "bakimx_product_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

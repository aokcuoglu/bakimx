-- CreateTable
CREATE TABLE "tecdoc_articles" (
    "id" BIGSERIAL NOT NULL,
    "vehicle_type_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "tecdoc_article_id" INTEGER NOT NULL,
    "article_no" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "supplier_id" INTEGER,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tecdoc_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tecdoc_articles_vehicle_type_id_category_id_idx" ON "tecdoc_articles"("vehicle_type_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "tecdoc_articles_vehicle_type_id_category_id_tecdoc_article__key" ON "tecdoc_articles"("vehicle_type_id", "category_id", "tecdoc_article_id");

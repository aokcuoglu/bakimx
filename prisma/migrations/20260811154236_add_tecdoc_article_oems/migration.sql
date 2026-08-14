-- CreateTable
CREATE TABLE "tecdoc_article_oems" (
    "id" BIGSERIAL NOT NULL,
    "tecdoc_article_id" INTEGER NOT NULL,
    "brand" TEXT NOT NULL,
    "oem_no" TEXT NOT NULL,
    "search_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tecdoc_article_oems_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tecdoc_article_oems_tecdoc_article_id_idx" ON "tecdoc_article_oems"("tecdoc_article_id");

-- CreateIndex
CREATE INDEX "tecdoc_article_oems_search_key_idx" ON "tecdoc_article_oems"("search_key");

-- CreateIndex
CREATE UNIQUE INDEX "tecdoc_article_oems_tecdoc_article_id_oem_no_key" ON "tecdoc_article_oems"("tecdoc_article_id", "oem_no");

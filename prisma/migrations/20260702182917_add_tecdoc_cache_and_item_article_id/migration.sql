-- AlterTable
ALTER TABLE "ServiceOrderItem" ADD COLUMN     "tecdocArticleId" INTEGER;

-- CreateTable
CREATE TABLE "tecdoc_cache" (
    "key" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "rawResponse" JSONB NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tecdoc_cache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "tecdoc_cache_createdAt_idx" ON "tecdoc_cache"("createdAt");

-- CreateIndex
CREATE INDEX "tecdoc_cache_endpoint_idx" ON "tecdoc_cache"("endpoint");

ALTER TABLE "bakimx_products"
ADD COLUMN "cross_references" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

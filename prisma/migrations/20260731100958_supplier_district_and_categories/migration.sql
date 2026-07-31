-- Supplier: İl/İlçe seçimi + çoklu kategori.
--   * district: yeni nullable kolon.
--   * category (tekil serbest metin) -> categories (dizi). Eski değerler DROP'tan ÖNCE taşınır (veri kaybı yok).

-- 1) Yeni kolonlar
ALTER TABLE "Supplier" ADD COLUMN "district" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "categories" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 2) Backfill: dolu olan tekil kategori tek elemanlı diziye taşınır
UPDATE "Supplier"
SET "categories" = ARRAY["category"]
WHERE "category" IS NOT NULL AND btrim("category") <> '';

-- 3) Eski kolon kaldırılır
ALTER TABLE "Supplier" DROP COLUMN "category";

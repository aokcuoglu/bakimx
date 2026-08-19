-- BAK-116: rate limit sayacını süreç-içi Map'ten paylaşımlı bir tabloya taşır.
--
-- Yalnız yeni bir tablo eklenir; mevcut hiçbir satır/sütun değişmez, geri alma
-- tek adımdır (DROP TABLE). Tablo kısa ömürlü sayaç satırları tutar — kalıcı
-- veri değildir, kaybı yalnız o dakikalık pencereyi sıfırlar.

-- CreateTable
CREATE TABLE "RateLimitCounter" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RateLimitCounter_resetAt_idx" ON "RateLimitCounter"("resetAt");

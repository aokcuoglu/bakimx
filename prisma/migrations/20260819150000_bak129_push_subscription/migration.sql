-- BAK-129 (Faz B): Web Push abonelikleri.
--
-- Yalnız yeni bir tablo eklenir; mevcut hiçbir satır/sütun değişmez. Geri alma
-- tek adımdır (DROP TABLE) ve veri kaybı yalnız "kullanıcılar bildirimleri
-- yeniden açsın" anlamına gelir — abonelik tarayıcıda yeniden üretilebilir bir
-- kayıttır, kalıcı iş verisi değildir.
--
-- `endpoint` GLOBAL benzersizdir (push servisinin ürettiği adres): aynı cihaz
-- ikinci kez abone olduğunda satır güncellenir, kopya açılmaz. Kullanıcı
-- silindiğinde abonelik de silinir (ON DELETE CASCADE) — atölye silme yolu yok,
-- bu yüzden Workshop bağı RESTRICT bırakıldı (diğer tenant tablolarıyla aynı).

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "workshopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_workshopId_userId_idx" ON "PushSubscription"("workshopId", "userId");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

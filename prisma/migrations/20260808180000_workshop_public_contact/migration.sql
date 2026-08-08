-- WorkshopSettings: müşteriye gösterilen pazarlama / iletişim bilgileri (#173).
-- Hepsi nullable; mevcut satırlara dokunulmaz, geri alınması DROP COLUMN ile
-- yeterlidir.
ALTER TABLE "WorkshopSettings" ADD COLUMN "facebookUrl" TEXT;
ALTER TABLE "WorkshopSettings" ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "WorkshopSettings" ADD COLUMN "xUrl" TEXT;
ALTER TABLE "WorkshopSettings" ADD COLUMN "tiktokUrl" TEXT;
ALTER TABLE "WorkshopSettings" ADD COLUMN "youtubeUrl" TEXT;
ALTER TABLE "WorkshopSettings" ADD COLUMN "linkedinUrl" TEXT;
ALTER TABLE "WorkshopSettings" ADD COLUMN "publicWhatsappNumber" TEXT;
ALTER TABLE "WorkshopSettings" ADD COLUMN "faxNumber" TEXT;
ALTER TABLE "WorkshopSettings" ADD COLUMN "secondaryPhone" TEXT;

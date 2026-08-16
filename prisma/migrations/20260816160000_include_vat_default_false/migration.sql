-- BAK-75: yeni iş emri kalemleri KDV'ye TABİ OLMADAN açılır.
--
-- Eskiden kolon `DEFAULT true` idi: kalem eklendiği anda belgenin KDV'sine tabi
-- oluyor, düzenleyici de tutarı "KDV dahil" kipinde gösterdiği için ₺100 yazan
-- kullanıcı satırda ₺83,33 okuyordu. Sözleşme tersine çevrildi — KDV yalnız
-- servis satırın tick'ini açtığında eklenir.
--
-- YALNIZCA DEFAULT değişir. Mevcut satırlara DOKUNULMAZ: bugüne kadar KDV'li
-- kaydedilmiş kalemler KDV'li kalır, aksi hâlde kapanmış iş emirlerinin Genel
-- Toplam'ı geriye dönük olarak düşerdi.
--
-- Geri alma: ALTER TABLE "ServiceOrderItem" ALTER COLUMN "includeVat" SET DEFAULT true;

-- AlterTable
ALTER TABLE "ServiceOrderItem" ALTER COLUMN "includeVat" SET DEFAULT false;

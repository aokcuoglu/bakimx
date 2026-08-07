-- CommunicationLog.internal: platform yöneticilerine giden sistem uyarılarını
-- kiracıya dönük iletişim geçmişinden ayırır (bkz. issue #194).
--
-- Uyumluluk: additive, DEFAULT'lu ve NOT NULL — eski uygulama sürümü kolonu hiç
-- görmeden çalışmaya devam eder, yeni sürüm deploy'dan önce de sonra da tutarlı.
-- Geri alma: `ALTER TABLE "CommunicationLog" DROP COLUMN "internal";`
-- (veri kaybı yalnız bu bayrakta olur, iletişim kayıtları etkilenmez).
ALTER TABLE "CommunicationLog" ADD COLUMN "internal" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: bugüne kadar kiracının ekranında görünen admin-hedefli satırları
-- işaretle. Dört anahtar ailesi, audience: "internal" ile gönderen dört çağrı
-- yeriyle birebir eşleşir: register/route.ts, tami/hash-fail-alert.ts,
-- tami/misconfig-alert.ts, billing/lifecycle.ts (alertStuckTransactionOnce).
UPDATE "CommunicationLog"
SET "internal" = true
WHERE "templateKey" = 'new_application_admin'
   OR "templateKey" LIKE 'hash_fail_alert:%'
   OR "templateKey" LIKE 'tami_misconfig_alert:%'
   OR "templateKey" LIKE 'stuck_txn_alert:%';

-- #827: ek özellik (add-on) yetkisi atölye bazında, tek tek tutulur.
-- Geçerli değerler src/lib/plan.ts `ADDON_FEATURES`; bütünlük kodda
-- (`normalizeAddons`), enum değil — bilinmeyen dize okumada yok sayılır.
-- Geriye uyumlu: varsayılan boş dizi, mevcut sorgular etkilenmez.

-- AlterTable
ALTER TABLE "Workshop" ADD COLUMN     "addons" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill: elle "Paket + ek özellikler" (`premium`) verilmiş atölyeler beş ek
-- özelliği de açık olarak taşır. `planTier`'a dokunulmaz — premium satırı
-- zaten hepsini açar; bu yazım, satır ileride self-serve yenilemeyle `pro`'ya
-- dönerse ek özelliklerin kaybolmamasını sağlar.
-- Deneme (`trialing`) satırları bilinçli olarak hariç: deneme ek özellikleri
-- `TRIAL_ACCESS_TIER` ile zaten açar; buraya yazılırsa ödeme sonrası da ücretsiz
-- açık kalırdı. `subscriptionStatus` NOT NULL bir enum olduğu için `<>`
-- karşılaştırmasında NULL'a düşen satır yoktur.
UPDATE "Workshop"
SET "addons" = ARRAY['vinLookup', 'partsCatalog', 'ocrIntake', 'eInvoice', 'multiBranch']
WHERE "planTier" = 'premium' AND "subscriptionStatus" <> 'trialing';

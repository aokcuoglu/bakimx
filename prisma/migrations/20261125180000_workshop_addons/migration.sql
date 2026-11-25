-- #827: ek özellik (add-on) yetkisi atölye bazında, tek tek tutulur.
-- Geçerli değerler src/lib/plan.ts `ADDON_FEATURES`; bütünlük kodda
-- (`normalizeAddons`), enum değil — bilinmeyen dize okumada yok sayılır.
-- Geriye uyumlu: varsayılan boş dizi, mevcut sorgular etkilenmez.

-- AlterTable
ALTER TABLE "Workshop" ADD COLUMN     "addons" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill: elle "Paket + ek özellikler" (`premium`) verilmiş ve ŞU AN aktif
-- (`active`) atölyeler beş ek özelliği de açık olarak taşır. `planTier`'a
-- dokunulmaz — premium satırı zaten hepsini açar; bu yazım, satır ileride
-- self-serve yenilemeyle `pro`'ya dönerse ek özelliklerin kaybolmamasını sağlar.
-- Bilinçli olarak hariç: `trialing` (deneme ek özellikleri `TRIAL_ACCESS_TIER` ile
-- zaten açar; yazılırsa ödeme sonrası da ücretsiz açık kalırdı) ve `past_due`,
-- `canceled` vb. (ödemesi sürmeyen satır kalıcı ek özellik kazanmasın; ileride
-- paket alırlarsa ek özellikler ayrıca açılır).
UPDATE "Workshop"
SET "addons" = ARRAY['vinLookup', 'partsCatalog', 'ocrIntake', 'eInvoice', 'multiBranch']
WHERE "planTier" = 'premium' AND "subscriptionStatus" = 'active';

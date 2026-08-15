-- Drift onarımı: `ServiceOrderItem.includeVat` (BAK-53) şemaya commit 40b6502 ile
-- girdi ama migration'ı hiç yazılmadı; `migrate deploy` kolonu açmadığı için
-- dev/prod veritabanlarında YOK ve kalem yazan her sorgu "column does not exist"
-- ile düşer. Kolon burada geriye dönük uyumlu şekilde açılıyor.
--
-- `DEFAULT true` mevcut satırların davranışını değiştirmez: sözleşme gereği alan
-- yok / null ise satır belgenin KDV'sine TABİDİR (bkz. src/lib/totals.ts, PR #360).
--
-- Kural: `bun run db:push` bir teslimat aracı değildir; şema değişikliği ve
-- migration aynı PR'da gider (docs/agent-workflows/repo-guardrails.md §3).

-- AlterTable
ALTER TABLE "ServiceOrderItem" ADD COLUMN IF NOT EXISTS "includeVat" BOOLEAN NOT NULL DEFAULT true;

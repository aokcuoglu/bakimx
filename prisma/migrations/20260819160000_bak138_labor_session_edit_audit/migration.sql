-- BAK-138: İşçilik süresi kaydına manuel düzeltme izi.
--
-- Yalnız iki NULLABLE kolon eklenir; mevcut satırlar değişmez ve eski kod bu
-- kolonları hiç okumadan çalışmaya devam eder (geriye dönük uyumlu). Geri alma
-- tek adımdır (DROP COLUMN) ve kaybedilen tek şey "kim düzeltti" işaretidir —
-- neyin değiştiği zaten `AuditLog` (`labor_session_edited`) satırında durur.
--
-- `note` kolonu ZATEN vardı (hiç yazılmıyordu); bu migration onu eklemez.
--
-- Düzenleyen kullanıcı silinirse kayıt SİLİNMEZ: FK `ON DELETE SET NULL` ile
-- yalnız işaret düşer. İşçilik süresi faturalanabilir bir iş verisidir, bir
-- personel hesabının ömrüne bağlanamaz (diğer tenant tabloları RESTRICT, burada
-- CASCADE veri kaybı olurdu).

-- AlterTable
ALTER TABLE "LaborSession" ADD COLUMN "editedAt" TIMESTAMP(3);
ALTER TABLE "LaborSession" ADD COLUMN "editedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "LaborSession_editedByUserId_idx" ON "LaborSession"("editedByUserId");

-- AddForeignKey
ALTER TABLE "LaborSession" ADD CONSTRAINT "LaborSession_editedByUserId_fkey" FOREIGN KEY ("editedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

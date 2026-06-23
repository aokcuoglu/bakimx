# BakımX — Veritabanı Yönetimi (DB.md)

Production veritabanını güvenle yönetmek için tek referans. "Push atınca DB reset mi olur,
migrate nasıl olur, eski data silinir mi?" sorularının net cevabı burada.

---

## 1. Zihinsel model (önce bunu oku)

- **Push → DB RESET OLMAZ.** GitHub Actions deploy'u sadece `app` container'ını yeniden
  oluşturur (`docker compose up -d app --force-recreate`). `db` servisine ve `pgdata`
  named volume'una **dokunmaz**. Postgres verisi app image'ından bağımsız, kalıcı diskte durur.
- **Migration OTOMATİK çalışmaz.** Ne Dockerfile başlangıcında ne CI'da migration adımı var.
  Şemayı sen, ayrı bir komutla uygularsın (aşağıda).
- **`migrate deploy` ileri-yöneliktir.** Yalnızca `prisma/migrations/` içindeki uygulanmamış
  migration'ları çalıştırır. Bir migration açıkça `DROP`/`DELETE` içermedikçe **veri silmez**.
- **`pgdata` ne zaman silinir?** Sadece `docker compose down -v` ile (named volume'u siler).
  Normal redeploy, `docker compose down` (`-v` olmadan), image rebuild → veri **korunur**.

---

## 2. Migration stratejisi: `prisma db push` DEĞİL, `migrate deploy`

Eskiden proje `db push` ile yürüyordu çünkü `prisma/migrations/` eksik bir baseline'dı
(33 tablonun sadece 8'ini oluşturuyordu, `migrate deploy` boş DB'de patlıyordu). Bu düzeltildi:

- **`prisma/migrations/0_init/`** — tüm şemayı (33 tablo + 30 enum + 68 FK) sıfırdan kuran
  tek, replay-edilebilir baseline. `migrate diff --from-empty --to-schema` ile üretildi ve
  boş bir DB'de temiz uygulandığı **doğrulandı**.
- Eski 4 eksik migration → `prisma/migrations_archive/` (Prisma artık görmez).

Artık **`db push`'u terk et**; aşağıdaki migrate akışını kullan. (`db:push` script'i sadece
tek seferlik hızlı prototip için durur; prod'da ASLA kullanma — bkz. §5.)

> **Not:** `prisma/sql/2026-06-22_*.sql` dosyalarındaki kolonlar artık `0_init`'e dahildir; bu dosyalar
> **geçmiş artıktır**. Baseline'lanmış bir DB'ye ASLA elle uygulama (içlerindeki eski `db push`/`psql -f`
> talimatları geçersiz).

---

## 3. Şema değişikliği iş akışı (local → prod)

### Local (geliştirme)
```bash
# 1) prisma/schema.prisma'yı düzenle
# 2) migration üret + lokale uygula:
bun run db:migrate            # = prisma migrate dev  (isim sorar veya --name ile geç)
# 3) üretilen prisma/migrations/<ts>_<isim>/ klasörünü COMMIT et
```
`migrate dev` migration dosyasını üretir, lokal DB'ye uygular ve Prisma client'ı yeniler.

### Production (VPS)
Migration'lar koda gömülü gelir (Dockerfile `prisma/`'yı image'a kopyalar). Yeni image
deploy edildikten sonra, **bir kez**:
```bash
cd /opt/bakimx
# Yedek al, sonra migration'ları uygula (script yedek + migrate deploy yapar):
./scripts/db-migrate-prod.sh      # yoksa manuel: aşağıdaki iki adım
```
Manuel eşdeğeri:
```bash
docker compose run --rm app sh -lc 'npx --yes prisma@7.8.0 migrate deploy'
```
> Prisma CLI standalone image'a dahil değildir → `npx --yes prisma@7.8.0` ile sürüm-sabit çalıştırılır.
> `migrate deploy` yalnızca bekleyen migration'ları uygular; mevcut veriye dokunmaz.

İstersen bu adım CI'a eklenebilir (deploy'dan önce, yedekle birlikte) — şimdilik manuel/script.

---

## 4. İLK KEZ: mevcut prod DB'yi baseline'lama (tek seferlik)

Prod DB şu an `db push` ile kurulduğu için tüm tablolar zaten var ama `_prisma_migrations`
tablosu yok. `migrate deploy` doğrudan çalıştırılırsa `0_init`'i çalıştırmaya çalışır ve
"tablo zaten var" hatası verir. Bu yüzden **mevcut DB'de** `0_init`'i çalıştırmadan
*uygulanmış* olarak işaretle (veriye dokunmaz):

```bash
cd /opt/bakimx
# (a) ÖNCE drift'i İNCELE — db push'u körlemesine çalıştırma:
docker compose run --rm app sh -lc \
  'npx --yes prisma@7.8.0 migrate diff --from-url "$DATABASE_URL" --to-schema prisma/schema.prisma --script'
#     • Çıktı BOŞ ise: prod zaten schema.prisma ile birebir → (a)'yı ATLA, doğrudan (b)'ye geç.
#     • Yalnız ADDITIVE (ADD COLUMN/CREATE) ise: önce YEDEK al (/opt/bakimx/backup.sh), sonra:
#       docker compose run --rm app sh -lc 'npx --yes prisma@7.8.0 db push'
#     • Çıktıda DROP/rename varsa: DUR — db push veri DÜŞÜRÜR; elle gözden geçir.
#   (0_init zaten schema.prisma ile birebir olduğu için (a) çoğunlukla GEREKSİZdir.)
# (b) 0_init'i ÇALIŞTIRMADAN uygulanmış işaretle (yalnız _prisma_migrations'a yazar, veriye dokunmaz):
docker compose run --rm app sh -lc 'npx --yes prisma@7.8.0 migrate resolve --applied 0_init'
# (c) Doğrula:
docker compose run --rm app sh -lc 'npx --yes prisma@7.8.0 migrate status'   # "up to date" beklenir
```
Bundan SONRA her şema değişikliği §3'teki `migrate deploy` ile gider.

**Yepyeni (boş) prod DB** ise (a)/(b) gerekmez; doğrudan `migrate deploy` 0_init'i kurar.

> Not: Local dev DB'n zaten `0_init` ile baseline'lı görünüyor (muhtemelen paralel terminaldeki
> oturumdan). Üretilen `0_init` o baseline ile Prisma-checksum olarak eşleşiyor (`migrate status`
> = "up to date"), yani tutarlı.

---

## 5. Veri-kaybı footgun'ları (bunları YAPMA)

| Tehlike | Neden | Doğrusu |
|---------|-------|---------|
| `docker compose down -v` (prod'da) | `pgdata` named volume'unu siler → tüm veri gider | Local'de `./scripts/local-reset.sh` (guard'lı). Prod'da ASLA `-v`. |
| `bun run db:push` prod'a | Kolon/tablo silinmişse veri kaybına yol açabilir | Sadece §4(a)'daki kontrollü tek sefer; gündelik değişiklik `migrate deploy`. |
| `bun run db:migrate` (`migrate dev`) prod'a | Drift görürse **tam reset** (drop+recreate) tetikleyebilir | `migrate dev` yalnız LOCAL. Prod'da yalnız `migrate deploy`. |
| `prisma/seed.ts` prod'a | Bilinen şifreli demo tenant + tahmin edilebilir public token enjekte eder | `NODE_ENV=production`'da bloklanır (override: `ALLOW_PROD_SEED=true`). |
| Kolon/tablo rename/remove içeren migration | `migrate deploy` o migration'ı çalıştırır → veri düşer | Yıkıcı migration'ları review et + önce yedek al. |

---

## 6. Yedekleme & geri yükleme

- **Otomatik:** `scripts/provision-vps.sh` günlük cron kurar — `03:15`'te `pg_dump --clean --if-exists`,
  gzip, `/opt/bakimx/backups`, 7 gün saklama. (getirbakim 03:00'te yedekliyor; çakışmasın diye 03:15.)
- **Offsite (önemli):** Şu an yedekler VPS diskinde; disk ölürse gider. `rclone` kurulu ama
  ayarlı değil. R2/B2'ye gönder: `rclone config` ile remote tanımla, sonra `.env.production`'a
  `BAKIMX_RCLONE_REMOTE=r2:bakimx-backups` ekle → backup script otomatik kopyalar.
- **Geri yükleme:** `./scripts/restore-db.sh /opt/bakimx/backups/bakimx_<ts>.sql.gz`
  (onay ister, dump `--clean` olduğu için yerinde geri yükler).
- **R2 (foto storage):** DB yedeği obje anahtarlarını tutar ama dosyalar R2'de. R2 bucket'ında
  **versiyonlama/lifecycle** aç ki foto kaybı da kurtarılabilsin.
- **Restore tatbikatı:** En az bir kez throwaway ortamda restore'u test et (test edilmemiş yedek = bilinmeyen RTO).

---

## 7. Hızlı referans

| İhtiyaç | Komut |
|---------|-------|
| Local şema değişikliği | `bun run db:migrate` |
| Prod'a migration uygula | `docker compose run --rm app sh -lc 'npx --yes prisma@7.8.0 migrate deploy'` |
| Mevcut prod'u baseline'la (tek sefer) | `... migrate resolve --applied 0_init` |
| Migration durumu | `... migrate status` |
| Local sıfırla (destructive) | `./scripts/local-reset.sh` |
| Prod yedek (manuel) | `/opt/bakimx/backup.sh` |
| Geri yükle | `./scripts/restore-db.sh <backup.sql.gz>` |

# scripts/

Tek seferlik ve operasyonel yardımcı script'ler. Çoğu `package.json` üzerinden
çalıştırılır — doğrudan çağırmak yerine npm script'ini tercih edin.

> **Not:** Bu klasördeki Python ruhsat-OCR script'leri (`registration_ocr.py`,
> `region_ocr.py`, `define_regions.py`) 2026-07'de, dayandıkları PaddleOCR
> sidecar'ı (`ocr-service/`) ile birlikte kaldırıldı. Ruhsat OCR artık uygulama
> içinde Claude Vision ile çalışıyor (`OCR_PROVIDER=anthropic`, bkz.
> `src/lib/ocr/`). Geçmişi `git log -- scripts/registration_ocr.py` ile görün.

## Veritabanı

| Script | npm script | Ne yapar |
| --- | --- | --- |
| `db-migrate-local.sh` | `bun run db:migrate` | Yerel migration authoring (`prisma migrate dev`) |
| `aws-dev-tunnel.sh` | `bun run db:tunnel` / `db:tunnel:prod` | AWS RDS'e SSM tüneli (localhost:5433) |
| `dev-with-tunnel.sh` | `bun run dev:tunnel` | Tünel + `next dev` birlikte |
| `migrate-vehicle-catalog.ts` | `bun run db:seed-catalog` | Araç marka/model kataloğunu seed'ler (deploy'da da çalışır) |
| `backfill-tecdoc-articles.ts` | `bun run db:backfill-articles` | Eksik TecDoc parça kayıtlarını doldurur (kotasız) |
| `find-duplicate-phones.ts` | `bun run db:find-dupe-phones` | Çakışan müşteri telefonlarını listeler |
| `merge-duplicate-customers.ts` | `bun run db:merge-customers` | Yinelenen müşterileri birleştirir |
| `local-reset.sh` | — | Yerel DB'yi sıfırlar (yalnız geliştirme) |
| `prod-reset.ts` | `bun run db:prod-reset` | Kiracı verisini siler, katalog/cache tablolarını korur (varsayılan rapor modu; `--confirm` ile uygular) |

> **Tünel çıktısı:** `aws-dev-tunnel.sh`, `session-manager-plugin`'in her TCP
> bağlantısı için bastığı `Connection accepted for session [...]` satırlarını
> filtreler — Prisma havuzu sürekli bağlantı açtığı için bu satırlar tüneli
> çalıştıran terminali (ve üstüne çizilen TUI'yi) doldururdu. Gerçek hatalar
> (bind hatası, süresi dolmuş SSO) filtreden geçmeye devam eder. Tüneli teşhis
> ederken ham çıktı için `TUNNEL_VERBOSE=1 bun run db:tunnel`.

## Operasyon

| Script | npm script | Ne yapar |
| --- | --- | --- |
| `workshop-admin.ts` | `bun run workshop` | İş yeri/kullanıcı yönetimi CLI'ı (`list`, `approve`, `reject`, `set-plan`, `set-seats`) |
| `release.mjs` | `bun run release` | Sürüm bump + tag + release notu akışı (bkz. `docs/releasing.md`) |
| `project-board-sync.sh` | `bun run project:sync` | Factory - BakimX panosunda kapalı issue'ların kartını Done'a çeker (`-- --dry-run` ile rapor) |
| `dr-drill.sh` | `bun run dr:drill` | Yedekten geri dönüş tatbikatı: en yeni otomatik snapshot → geçici instance → doğrula → sil |
| `dr-verify.ts` | `bun run dr:verify` | Geri yüklenmiş bir DB'yi salt-okunur doğrular (bağlantı, migration bütünlüğü, veri, tazelik) |

> **DR tatbikatı kaynak veritabanına dokunmaz** ve her çıkış yolunda (hata,
> Ctrl-C dahil) geçici instance'ı siler. `--keep` verirsen silmez — bittiğinde
> `bash scripts/dr-drill.sh teardown <id>` çalıştırmayı unutma, saatlik ücret
> yazar. Prosedür ve tatbikat kaydı:
> [`docs/operations/disaster-recovery.md`](../docs/operations/disaster-recovery.md).

> **`set-plan` ve ücretli dönem:** `set-plan <id|email> <tier> active` tek başına
> yalnız paket + durum yazar; `currentPeriodEnd` boş kalır ve plan "süresiz"
> görünür. Gerçek bir satın almayı taklit etmek için dönemi de verin:
>
> ```sh
> bun run workshop set-plan usta@atolye.com premium active --cycle yearly
> bun run workshop set-plan usta@atolye.com pro active --cycle monthly --ends-in 3
> bun run workshop set-plan usta@atolye.com pro active --ends-in -1   # süresi dolmuş
> ```
>
> `--ends-in` bilerek 0/negatif günü de kabul eder — `subscription_expired`
> kilidini ve abonelik bitiş uyarılarını (`src/lib/billing/lifecycle.ts`) gerçek
> bir ödeme akışı kurmadan test etmenin tek yolu budur. Bayrak verilmezse dönem
> alanlarına dokunulmaz. `list` çıktısı dönemi `abone→<tarih>` olarak gösterir,
> geçmiş tarihleri ⛔ ile işaretler.

> Contabo VPS dönemine ait script'ler (`provision-vps.sh`, `restore-db.sh`,
> `db-migrate-prod.sh`) 2026-07'de kaldırıldı — BakımX AWS ECS üzerinde çalışıyor
> ve o host'a dönmeyecek. Migration'lar deploy'da otomatik uygulanıyor
> (bkz. [`docs/database.md`](../docs/database.md)).

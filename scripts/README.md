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

## Operasyon

| Script | npm script | Ne yapar |
| --- | --- | --- |
| `workshop-admin.ts` | `bun run workshop` | İş yeri/kullanıcı yönetimi CLI'ı |
| `release.mjs` | `bun run release` | Sürüm bump + tag + release notu akışı (bkz. `docs/releasing.md`) |

> Contabo VPS dönemine ait script'ler (`provision-vps.sh`, `restore-db.sh`,
> `db-migrate-prod.sh`) 2026-07'de kaldırıldı — BakımX AWS ECS üzerinde çalışıyor
> ve o host'a dönmeyecek. Migration'lar deploy'da otomatik uygulanıyor
> (bkz. [`docs/database.md`](../docs/database.md)).

# Veritabanı yönetimi

Şema değişikliği, migration ve yedekleme için tek referans. Kaynak-doğruluk
`prisma/schema.prisma` + `prisma/migrations/`.

Ortamlar ve altyapı için [releasing.md](./releasing.md) ve
[deployment/](./deployment/) klasörüne bak.

---

## 1. Zihinsel model

- **Migration'lar deploy'da OTOMATİK uygulanır.** Hem `deploy-dev-aws.yml` hem
  `deploy-prod-aws.yml`, servisi güncellemeden **önce** tek seferlik bir ECS
  görevinde `prisma migrate deploy` çalıştırır. Bu bir **kapıdır**: migration
  patlarsa deploy durur ve çalışan uygulamaya dokunulmaz. Elle migration
  çalıştırmanıza gerek yok.
- **`migrate deploy` ileri-yöneliktir.** Yalnız `prisma/migrations/` içindeki
  uygulanmamış migration'ları çalıştırır. Migration açıkça `DROP`/`DELETE`
  içermedikçe veri silmez.
- **Baseline `0_init`.** Tüm şemayı sıfırdan kuran tek, replay-edilebilir
  migration (v0.5.8'de geçmiş squash'landı). Sonrasındaki her değişiklik ayrı
  bir artımlı migration.
- **dev ve prod ayrı RDS örnekleridir.** dev asla prod verisine dokunmaz.

---

## 2. Şema değişikliği iş akışı

```bash
# 1) prisma/schema.prisma'yı düzenle
# 2) migration üret + yerel DB'ye uygula:
bun run db:migrate          # = prisma migrate dev
# 3) üretilen prisma/migrations/<ts>_<isim>/ klasörünü COMMIT et
```

Sonrası otomatik: `dev`'e merge → app-dev deploy'unda migration kapısı çalışır →
`main`'e merge → prod deploy'unda aynı kapı çalışır.

> **Yerel geliştirme AWS dev DB'sine bağlanır** (`.env.local` → `localhost:5433`,
> `bun run db:tunnel` ile SSM tüneli açıkken). `db:migrate` yerel authoring,
> `db:deploy` tünelden AWS dev'e uygular.

### Paralel worktree uyarısı

Birden fazla worktree tek DB'yi paylaşıp `migrate dev` çalıştırırsa Prisma
yabancı migration'ları **drift** sayar ve reset önerir. Paralel şema işi
yapıyorsanız o worktree'ye ayrı bir veritabanı verin.

---

## 3. Veri-kaybı footgun'ları

| Tehlike | Neden | Doğrusu |
|---|---|---|
| `bun run db:push` (prod/dev'e) | Migration geçmişini atlar; kolon/tablo silinmişse veri kaybettirir | Yalnız tek seferlik yerel prototip. Kalıcı değişiklik = migration. |
| `bun run db:migrate` (`migrate dev`) uzak DB'ye | Drift görürse **tam reset** (drop+recreate) tetikleyebilir | `migrate dev` yalnız YEREL. Uzakta yalnız `migrate deploy`. |
| `prisma/seed.ts` prod'a | Bilinen şifreli demo tenant + tahmin edilebilir public token enjekte eder | `NODE_ENV=production`'da bloklanır (override: `ALLOW_PROD_SEED=true`). |
| Rename/remove içeren migration | `migrate deploy` onu çalıştırır → veri düşer | Yıkıcı migration'ları elle review et; boş app-dev'de geçen bir migration prod verisinde patlayabilir. |
| Uygulanmış bir migration'ı düzenlemek | Checksum tutmaz, geçmiş bozulur | Asla düzenleme; yeni migration ekle. |

---

## 4. Yedekleme & geri yükleme

- **Otomatik:** RDS otomatik yedekleme + point-in-time recovery. Saklama süresi
  ve pencere CDK'da (`bakimx-prod-*` stack'leri) tanımlı.
- **Geri yükleme:** RDS snapshot'ından yeni bir örneğe restore edilir; ardından
  ECS servisinin `DATABASE_URL`'i yeni endpoint'e çevrilir.
- **Foto/görsel (S3/R2):** DB yedeği yalnız obje anahtarlarını tutar, dosyalar
  object storage'da. Bucket'ta **versiyonlama/lifecycle** açık olmalı ki foto
  kaybı da kurtarılabilsin.
- **Restore tatbikatı:** En az bir kez atılabilir bir ortamda restore'u test
  edin — test edilmemiş yedek = bilinmeyen RTO.

---

## 5. Hızlı referans

| İhtiyaç | Komut |
|---|---|
| Yerel şema değişikliği | `bun run db:migrate` |
| AWS dev'e migration uygula (tünelden) | `bun run db:deploy` |
| Migration durumu | `bunx prisma migrate status` |
| Şemayı doğrula | `bun run db:validate` |
| Prisma Studio | `bun run db:studio` |
| SSM tüneli aç | `bun run db:tunnel` (prod: `db:tunnel:prod`) |
| Araç kataloğunu seed'le | `bun run db:seed-catalog` |
| Yerel DB'yi sıfırla (yıkıcı) | `./scripts/local-reset.sh` |

---

## 6. Sorun giderme

**`relation "..." already exists`** — Hedef DB'de tablolar var ama
`_prisma_migrations` geçmişi yok. `0_init`'i çalıştırmadan uygulanmış işaretle:

```bash
bunx prisma migrate resolve --applied 0_init
```

Ardından `migrate status` ile doğrula. (Temiz AWS cutover'ından sonra bu durumun
çıkmaması gerekir; çıkarsa yanlış DB'ye bakıyor olabilirsiniz.)

**`migrate status` yeşil ama `migrate dev` reset istiyor** — Paylaşılan/drift'li
bir DB'de yabancı migration var. Elle SQL + `migrate deploy`/`migrate resolve`
ile ilerleyin; `migrate dev` kullanmayın.

**Prisma `ECONNREFUSED localhost:5432`** — Yerel Postgres ayakta değil:
`docker compose -f docker-compose.local.yml up -d`. AWS dev DB'sine bağlanıyorsanız
tünelin (`bun run db:tunnel`, port **5433**) açık olduğundan emin olun.

# Dev/Main + Staging + Otomatik-Migrate Release Pipeline

- **Tarih:** 2026-06-24
- **Durum:** Tasarım onaylandı — implementasyon planı bekleniyor
- **Branch:** `feat/release-pipeline` (v0.5.12 / `b7bebe5` tabanlı)

## 1. Bağlam ve Problem

2026-06-24'te bir prod olayı yaşandı: `deploy.yml` `v*` tag push'unda otomatik prod deploy ediyor. `v0.5.12` tag'i sadece amaçlanan özelliği değil, `main`'de **v0.5.11'den beri deploy edilmemiş** bir backlog'u (`37cad36` — bir Prisma migration içeriyor: `20260623000001_add_demo_and_support_requests`) toplu halde prod'a taşıdı. Üstelik deploy **DB migrate etmiyor** → kod yeni şemayı bekliyor ama prod DB'de migration uygulanmamış → gizli şema-uyumsuzluğu.

Kök nedenler:
1. **`main` deploy edilmemiş iş biriktirdi** ve bir tag onu sürpriz şekilde toplu yayınladı.
2. **Migration kapısı yok** — deploy şemayı senkronlamıyor.
3. **Pre-prod doğrulama ortamı (staging) yok** — değişiklikler kullanıcıdan önce hiçbir yerde görülmüyor.

Solo "vibecoding" bir geliştirici için hedef: kurumsal-düzey, kendini-koruyan bir release hattı. (Bkz. memory: proactively-suggest-pro-practices, prod-deploy-architecture.)

## 2. Hedefler / Hedef-dışı

**Hedefler**
- `dev` (entegrasyon) / `main` (prod aynası) branch modeli.
- Her `dev` push'unda otomatik **staging** deploy (ayrı app + ayrı DB + ayrı subdomain).
- Release'de **otomatik, idempotent DB migration** (app recreate'inden önce tek-seferlik `prisma migrate deploy`), staging önce yakalar.
- `RELEASE.md` + branch modeli dokümanı.

**Hedef-dışı (bu spec)**
- Monitoring/alerting, otomatik DB yedekleme, blue-green/zero-downtime deploy (gelecek — §11 "Önerilen sonraki adımlar").
- Uygulama kodu değişikliği (bu tamamen release-altyapısı).

## 3. Branch Modeli ve Release Akışı

```
feature/* ──PR──▶ dev ──(her push, otomatik)──▶ STAGING
                  │
                  └──PR──▶ main ──tag vX.Y.Z──▶ PROD
```
- **`dev`** = entegrasyon dalı. Tüm `feature/*` buraya PR'lanır. `main`'den (v0.5.12) dallanır.
- **`main`** = prod aynası; yalnızca staging'de doğrulanmış sürümler. main'i tag'lemek prod'a deploy eder.
- **Koruma (solo, hafif):** `main`'e force-push kapalı; doğrudan push yerine `dev→main` PR tercih edilir (zorunlu review yok — solo).
- **Bootstrap notu:** bu pipeline'ın KENDİSİ ilk kez prod'a giderken staging henüz yok; bu ilk deploy kaçınılmaz olarak doğrudan prod'a gider. Tek-seferlik migrate düşük risklidir (idempotent + abort-on-fail) ve bu ilk prod deploy bekleyen `add_demo_and_support_requests` migration'ını da otomatik uygular.

## 4. Ortamlar

| | Prod (mevcut) | Staging (yeni) |
|---|---|---|
| VPS dizini | `/opt/bakimx` | `/opt/bakimx-staging` |
| Domain | app.bakimx.com | staging.app.bakimx.com |
| App image tag | `:latest` + `:vX.Y.Z` | `:staging` |
| DB | `db` konteyneri + `pgdata` | **ayrı** `db-staging` + ayrı `pgdata-staging` volume |
| Env dosyası | `.env.production` | `.env.staging` |
| Deploy tetiği | `v*` tag | `dev` push |
| Proxy alias | `bakimx-app` | `bakimx-staging-app` |
| Bellek limiti | app 2g / db 1g | app 1g / db 512m (staging hafif) |

Staging aynı VPS'te ek ~1.5GB RAM ister; prod ile `db`/volume tamamen ayrıktır (migration güvenliği).

## 5. Otomatik-Migrate Mekanizması (app recreate'inden ÖNCE, tek-seferlik)

Migration, app yeniden oluşturulmadan **ÖNCE** ayrı bir tek-seferlik adım olarak çalışır (app entrypoint'inde değil — bu, bozuk bir migration'da prod'u crash-loop'a sokmaz):

Deploy script'i (her iki ortam):
```
docker compose pull app
docker compose run --rm migrate        # prisma migrate deploy (yeni image ile, idempotent)
docker compose up -d --force-recreate app
```
Migration başarısızsa zincir durur (`&&`) → app yeniden oluşturulmaz → **eski app çalışmaya devam eder (downtime yok, sadece deploy 'failed' raporlanır).** Bu, entrypoint-içi migrate'in crash-loop riskini ortadan kaldırır.

- `migrate`, az önce çekilen image üzerinden çalışır (yeni schema + migrations + prisma CLI içerir), aynı DB env'iyle, `db` healthy iken. Idempotent: yalnızca uygulanmamış migration'ları ekler, mevcut veriyi bozmaz.
- `dev→staging` akışı `main→prod`'dan önce olduğu için bozuk/destructive bir migration **staging'de** patlar → prod'a ulaşmaz. (Data-bağımlı migration hataları için staging'i prod-benzeri veriyle beslemek faydalı — §11.)
- **Dockerfile değişikliği:** runner (Next standalone) **prisma CLI içermiyor**; `prisma/` zaten kopyalı (Dockerfile satır 32). Tek-seferlik migrate'in çalışması için runner'a prisma CLI eklenir (deps stage'inden kopyalama ya da runner'da kurulum — plan detayı). `@prisma/client` zaten standalone'da. `CMD ["node","server.js"]` aynen kalır.
- **Uygulama:** compose'a `up` ile başlamayan bir `migrate` servisi (app image'ı, komut `prisma migrate deploy`, `profiles: ["tools"]`, `depends_on: db healthy`, `env_file` aynı) eklenir; deploy `docker compose run --rm migrate` ile çağırır.

## 6. CI/CD

- **Yeni `.github/workflows/staging.yml`:** `on: push: branches: [dev]` → image build (`:staging` + `:sha`) → VPS'e SSH → `/opt/bakimx-staging`'de `pull → run --rm migrate → up -d --force-recreate app`.
- **`.github/workflows/deploy.yml` (değişen):** tetik aynen `v*` tag → prod. SSH script'ine `up -d` öncesi tek-seferlik **migrate adımı** (`run --rm migrate`, abort-on-fail) eklenir.
- İki workflow aynı SSH secret'larını (VPS_HOST/USER/SSH_KEY) kullanır; yalnızca hedef dizin ve compose dosyası farklı.

## 7. Image / Tag Stratejisi

Aynı Dockerfile, aynı image repo (`ghcr.io/aokcuoglu/app`), farklı tag:
- Prod: `latest`, `vX.Y.Z`, `{major}.{minor}`, `sha-...` (mevcut metadata-action).
- Staging: `staging`, `sha-...`. `docker-compose.staging.yml` `:staging`'i referanslar.

## 8. Güvenlik / İzolasyon

- **Cookie izolasyonu (kritik):** prod `.bakimx.com` cookie domain kullanıyor (subdomain-split, host-aware middleware). `staging.app.bakimx.com` aynı `.bakimx.com`'u kullanırsa **prod oturum cookie'leriyle çakışır**. Staging cookie kapsamı `.env.staging`'de ayrılır. Plan, host-aware middleware/cookie mantığını okuyup staging host'unun doğru kapsandığını (ve gerekirse middleware'in staging host'unu tanıdığını) **doğrulamalı**.
- **Staging gizliliği:** staging public/arama-motoru görünür olmasın → Caddy route'unda `noindex` header + opsiyonel basic-auth.
- **Tenant izolasyonu / auth:** değişmez (yalnızca altyapı).

## 9. Faz Planı

- **Faz 1 (repo-tarafı, hemen, düşük altyapı bağımlılığı):** `dev` branch + tek-seferlik migrate altyapısı (Dockerfile prisma CLI + compose `migrate` servisi + `deploy.yml` migrate adımı) + `RELEASE.md`. *Bu, bir sonraki prod deploy'unu otomatik korur ve bekleyen migration'ı uygular.*
- **Faz 2 (repo + kullanıcı altyapısı):** `docker-compose.staging.yml` + `staging.yml` workflow (ben) + kullanıcı altyapı adımları (§10).

## 10. Kullanıcı Altyapı Adımları (Faz 2 — bende olmayan)

1. **DNS:** `staging.app.bakimx.com` A kaydı → VPS IP.
2. **Caddy/reverse-proxy:** `staging.app.bakimx.com` → `bakimx-staging-app:3000` route (+ `noindex`, opsiyonel basic-auth).
3. **VPS:** `/opt/bakimx-staging` oluştur; `docker-compose.staging.yml` + `.env.staging` (ayrı DB creds, ayrı `SESSION_SECRET`, staging-kapsamlı cookie ayarı) koy.
4. **GitHub secret:** mevcut `VPS_HOST/USER/SSH_KEY` yeniden kullanılır; ek secret gerekmez (aynı VPS/user). Gerekirse staging için ayrı set.
5. **İlk staging DB:** boş başlar; migrate adımı şemayı kurar; opsiyonel `db:seed`.

## 11. Riskler ve Önlemler / Önerilen Sonraki Adımlar

| Risk | Önlem |
|------|-------|
| Bootstrap: ilk pipeline deploy'u staging'siz prod'a gider | Tek-seferlik migrate idempotent + abort-on-fail + build doğrulanır; bekleyen migration zaten additive |
| Destructive migration prod'a kaçar | `dev→staging` önce → staging'de patlar; ayrıca destructive migration'lar manuel gözden geçirilir |
| Migrate prod'da başarısız | Migrate app recreate'inden ÖNCE çalışır; başarısızsa app recreate edilmez → **eski app ayakta, downtime yok**, deploy 'failed' |
| VPS RAM yetmezse | Staging limitleri düşük (app 1g/db 512m); gerekirse staging'i durdur/uyut |

**Önerilen sonraki adımlar (bu spec dışında, profesyonel hijyen — kullanıcıya hatırlatma):**
- **Dockerfile install pinning:** deps stage `npm install --frozen-lockfile`'ı **bun.lock** ile çalıştırıyor — npm bun.lock'u okuyamaz ve `--frozen-lockfile` geçerli npm flag'i değil → kurulum pinlenmiyor; ayrıca bun `patchedDependencies` (next@16.2.6 patch) uygulanmıyor. `bun install --frozen-lockfile`'a geçmek önerilir (ayrı, dikkatli test edilecek değişiklik).
- **Staging'i prod-benzeri (sanitize) veriyle besle** → data-bağımlı migration hatalarını da yakalar.
- DB otomatik yedekleme (pg_dump cron) + restore provası; uptime/hata izleme.

## 12. Eklenen/Değişen Dosyalar

**Faz 1**
- `Dockerfile` (değişen) — prisma CLI'yi runner'a ekle (tek-seferlik migrate için). `CMD node server.js` aynı kalır.
- `docker-compose.yml` (değişen) — `up` ile başlamayan bir `migrate` servisi ekle (`profiles: ["tools"]`).
- `.github/workflows/deploy.yml` (değişen) — SSH script'ine `up -d` öncesi `run --rm migrate` (abort-on-fail) adımı.
- `RELEASE.md` (yeni) — akış + checklist (feature→dev→staging doğrula→dev→main PR→tag→prod).
- `dev` branch oluşturma (git işlemi, kod değil).

**Faz 2**
- `docker-compose.staging.yml` (yeni) — `app-staging` + `db-staging` + `migrate` servisi.
- `.github/workflows/staging.yml` (yeni) — `dev` push → build `:staging` → deploy `/opt/bakimx-staging`.

## 13. Çözülen Kararlar (onaylı)
1. Staging: aynı VPS'te ayrı stack (app+DB+subdomain), `dev` push'unda otomatik. ✓
2. Migration: deploy'da otomatik, app recreate'inden ÖNCE tek-seferlik `prisma migrate deploy` (abort-on-fail → downtime yok), staging önce yakalar. ✓ *(Onaylanan "otomatik migrate" kararının daha güvenli uygulaması — entrypoint yerine pre-recreate adım.)*
3. Branch modeli: `dev` (entegrasyon) → `main` (prod), tag ile prod deploy. ✓

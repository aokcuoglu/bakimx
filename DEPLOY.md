# BakımX — Production Deploy (app.bakimx.com)

Hedef: BakımX'i **https://app.bakimx.com** adresinde yayınlamak. Veritabanı yönetiminin
ayrıntısı için **DB.md**'ye bak; bu dosya deploy akışını anlatır.

## Mimari (gerçek durum)
- Next.js (standalone) + PostgreSQL (Docker) **tek bir VPS**'te çalışır.
- Reverse proxy ve TLS, **getirbakim projesinin Nginx'i** tarafından yönetilir
  (`getirbakim-nginx`, 80/443). `getirbakim_app-network` Docker ağının **sahibi getirbakim**'dir;
  bakimx bu ağa `external` olarak katılır. **Ortada Caddy YOKTUR.**
- Foto/görsel depolaması **Cloudflare R2** (S3 uyumlu).
- Deploy: GitHub Actions (`.github/workflows/deploy.yml`) — `v*` tag'inde GHCR'ye build,
  VPS'e SSH ile `pull` + `up -d app`.

> Bu yığın Docker + Postgres gerektirir; **Hostinger shared hosting'de çalışmaz**, VPS şarttır.
> Hostinger domaini için yalnızca DNS kullanılır (Adım 3).

---

## 0. Repo'da hazır olanlar
- `docker-compose.yml` → `ghcr.io/aokcuoglu/app:latest`; proxy ağında stabil alias **`bakimx-app`**;
  app+db'ye memory limit; cross-stack `system prune` kaldırıldı.
- `prisma/migrations/0_init/` → tam, replay-edilebilir şema baseline'ı (bkz. DB.md).
- `scripts/` → `provision-vps.sh`, `db-migrate-prod.sh`, `restore-db.sh`, `local-reset.sh`.

---

## 1. Cloudflare R2
1. `bakimx-media` bucket'ı oluştur.
2. R2 API Token → `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
3. Public erişim (public share sayfası müşteriye foto gösterir): bucket'a public erişim aç
   (r2.dev alt alanı veya `media.bakimx.com`) ve `S3_PUBLIC_DOMAIN`'i ona ayarla. Boş bırakılırsa
   süreli (presigned) URL üretilir → paylaşılan linklerdeki fotolar süre dolunca kırılır.
   (`src/lib/storage/s3-storage-provider.ts`)
4. R2 bucket'ında **versiyonlama/lifecycle** aç (foto yedeği — bkz. DB.md §6).

## 2. GitHub Actions secret'ları
- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`.
- GHCR paketi (`ghcr.io/aokcuoglu/app`) private ise VPS'te bir kez:
  `docker login ghcr.io -u aokcuoglu -p <read:packages PAT>` — ya da paketi public yap.

## 3. DNS (Hostinger hPanel)
- bakimx.com DNS bölgesi → **A kaydı**: `app` → `<VPS public IP>` (TTL ~300s).
- TLS sertifikasını getirbakim'in Nginx'i Let's Encrypt ile alır (80/443 zaten açık).

## 4. VPS — `/opt/bakimx`
`scripts/provision-vps.sh` daha önce çalıştırıldıysa (UFW, fail2ban, backup cron, SSH) tekrar gerekmez.

1. **`.env.production`** oluştur (`.env.production.example`'dan):
   - `openssl rand -base64 48` → `SESSION_SECRET` (min 32 char), `CRON_SECRET`, güçlü `POSTGRES_PASSWORD`.
   - `POSTGRES_PASSWORD` ile `DATABASE_URL`/`DIRECT_URL` şifreleri **birebir aynı** (host `db`, port 5432).
   - `APP_URL=https://app.bakimx.com`
   - R2 değerleri (Adım 1). Opsiyonel: `BAKIMX_RCLONE_REMOTE` (offsite yedek).
   - Sağlayıcılar (SMS/WhatsApp/Email/OCR) istenirse `mock` yerine gerçek key'ler.
2. **Compose'u koy + proje adını sabitle.** `docker-compose.yml`'i `/opt/bakimx/`'e koy.
   Container/backup adlarının ve alias'ın deterministik olması için proje adını sabitle:
   ```bash
   echo "COMPOSE_PROJECT_NAME=bakimx" >> /opt/bakimx/.env   # (compose CLI bunu okur)
   ```
3. **Nginx routing (getirbakim tarafı).** getirbakim'in Nginx config'ine app.bakimx.com server
   bloğu ekle ve **alias'ı** hedefle (container adına değil):
   ```nginx
   server {
       server_name app.bakimx.com;
       client_max_body_size 10M;            # foto upload
       location / {
           proxy_pass http://bakimx-app:3000;   # docker-compose.yml'deki proxy alias
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   Nginx'in `getirbakim_app-network`'e bağlı ve `resolver 127.0.0.11` ayarlı olduğundan emin ol
   (zaten öyle). Sonra Nginx'i reload et.
4. **Başlatma sırası:** Ağın sahibi getirbakim. Önce getirbakim (ve dolayısıyla ağ) ayakta olmalı,
   sonra `cd /opt/bakimx && docker compose up -d`. Aksi halde bakimx "network getirbakim_app-network
   not found" ile başlamaz.

## 5. İlk deploy
1. Commit edilmemiş değişiklikleri **commit + push** et (yoksa eski kod deploy olur).
2. Yeni tag at — **`v0.5.9` kullanılmış, `v0.5.10` kullan** (veya Actions'tan `workflow_dispatch`):
   ```bash
   git tag v0.5.10 && git push origin v0.5.10
   ```
   Workflow image'ı GHCR'ye build/push eder, sonra VPS'e SSH ile `pull` + `up -d app` yapar.

## 6. Şema kurulumu (bir kez) — ayrıntı: **DB.md**
- **Mevcut (db-push'lu) prod DB'yi baseline'la** (ayrıntı + yıkıcı-drift kontrolü: DB.md §4):
  ```bash
  cd /opt/bakimx
  # 0_init zaten schema.prisma ile birebir → ekstra `db push` ÇOĞUNLUKLA GEREKSİZ.
  # (Gerekiyorsa önce DB.md §4'teki drift kontrolünü yap + yedek al; `db push` yıkıcı olabilir.)
  docker compose run --rm app sh -lc 'npx --yes prisma@7.8.0 migrate resolve --applied 0_init'
  ```
- **Yepyeni boş DB ise:** `docker compose run --rm app sh -lc 'npx --yes prisma@7.8.0 migrate deploy'`
- Sonraki şema değişiklikleri: `./scripts/db-migrate-prod.sh` (yedek + `migrate deploy`).
- (Opsiyonel) Demo veri: `docker compose run --rm app sh -lc 'ALLOW_PROD_SEED=true npx --yes tsx prisma/seed.ts'`
  — dikkat: bilinen şifreli demo tenant ekler; gerçek atölye için `bun run workshop` / `scripts/workshop-admin.ts`.

## 7. (Opsiyonel) Hatırlatma cron'u
```
*/15 * * * * curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://app.bakimx.com/api/cron/reminders >/dev/null 2>&1
```

---

## Doğrulama
1. `dig +short app.bakimx.com` → VPS IP.
2. `curl -I https://app.bakimx.com` → 200/302 + geçerli sertifika.
3. Şema: `docker compose exec db psql -U bakimx -d bakimx -c '\d "Workshop"'` → plan/subscription/approval kolonları.
4. Migration durumu: `docker compose run --rm app sh -lc 'npx --yes prisma@7.8.0 migrate status'` → "up to date".
5. Login → cookie `bakimx_session` (HTTPS'te `secure`).
6. Foto upload → R2'de obje → public share sayfası gizli sekmede açılır.
7. Yeniden deploy: küçük değişiklik + yeni tag → Actions yeşil → `up -d app --force-recreate`.

## Co-hosting (getirbakim + bakimx) — kritik notlar
- **Ağ sahipliği:** `getirbakim_app-network`'ün sahibi getirbakim. getirbakim down/recreate olursa
  bakimx etkilenir. Daha sağlamı: ağı her iki stack'ten bağımsız `docker network create edge` ile
  oluşturup ikisinde de `external` referanslamak (ileride).
- **İsim determinizmi:** Nginx alias `bakimx-app`'i hedefler; `COMPOSE_PROJECT_NAME=bakimx`
  backup'ın container adını da deterministik tutar.
- **Prune:** bakimx CI artık yalnız `docker image prune -f` (dangling) yapar — getirbakim image'larını silmez.
- **Kaynak:** İki app+Postgres + Nginx + Meilisearch için **≥8GB/4vCPU** öner; bakimx app/db'ye memory limit eklendi.
- **Yedek:** getirbakim 03:00, bakimx 03:15 yedekliyor; ikisi de offsite değil → rclone ile R2/B2'ye gönder (DB.md §6).

## Risk alanları
- **Şema:** `migrate deploy` kullan, `db push`/`db:migrate` prod'a değil (DB.md §5).
- **Image pull:** GHCR namespace `aokcuoglu`; private ise VPS login şart.
- **R2 public erişim:** Yanlışsa public share fotoları kırılır.
- **Commit edilmemiş değişiklikler:** Tag öncesi push edilmezse canlıya eski kod gider.
- **`SESSION_SECRET` < 32 char** prod'da app'i başlatmaz.

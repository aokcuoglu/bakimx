# Staging — one-time VPS/infra setup

Repo side (compose, workflow, env template) is committed. These steps are yours,
done once, before the first `dev` push deploys staging.

1. **DNS:** add an A record `staging.app.bakimx.com` → the VPS IP.
2. **VPS dir:** on the VPS, `mkdir -p /opt/bakimx-staging`; create `.env.staging` there
   from `.env.staging.example` with a DISTINCT `SESSION_SECRET`, own DB creds, and
   `SESSION_COOKIE_DOMAIN=staging.app.bakimx.com`, `SESSION_COOKIE_NAME=bakimx_session_staging`.
   Mirror any other prod vars (S3/MinIO etc.), staging-scoped. (The `staging.yml` workflow
   syncs `docker-compose.staging.yml` into this dir automatically on each `dev` push — you
   only create the dir + `.env.staging`.)
3. **Reverse proxy (getirbakim's Nginx — NOT Caddy): ✅ DONE 2026-07-13.** Added nginx :80/:443
   server blocks for `staging.app.bakimx.com` → `bakimx-staging-app:3000` in
   `/opt/getirbakim/infra/nginx/nginx.production.conf` on the VPS (mirrored into the getirbakim
   repo, commit 7bae70db). The Let's Encrypt cert already existed
   (`/etc/letsencrypt/live/staging.app.bakimx.com/`, issued 2026-06-25) — only the server blocks
   were missing, which is why nginx fell back to the getirbakim default server and served the
   wrong cert (`SSL_ERROR_BAD_CERT_DOMAIN` + redirect to getirbakim.com). The :443 block carries
   `add_header X-Robots-Tag "noindex, nofollow"` so staging isn't indexed. DNS `staging.app.bakimx.com`
   → VPS IP is **Cloudflare DNS-only (grey cloud)** — required for the certbot webroot HTTP-01
   challenge; keep it grey. To issue a fresh cert if ever needed:
   `certbot certonly --webroot -w /var/www/certbot -d staging.app.bakimx.com`, then reload:
   `docker exec getirbakim-nginx nginx -t && docker exec getirbakim-nginx nginx -s reload`.

   > **Gotcha:** this shared nginx serves getirbakim.com + bakimx.com + www + app.bakimx.com +
   > staging.app.bakimx.com. Any NEW subdomain needs its server block **hand-added to the live
   > conf** — the cert alone is not enough. nginx is edited live on the VPS then mirrored back to
   > the repo (it is NOT repo-deployed). app.bakimx.com had the same missing-block bug (301 to
   > getirbakim.com) and was fixed the same day (getirbakim commit fa72df6c).
4. **GitHub secrets:** none new — `staging.yml` reuses `VPS_HOST` / `VPS_USER` / `VPS_SSH_KEY`.
5. **First deploy:** push `dev` (or run the "Deploy to Staging" workflow). The migrate step
   creates the schema in the empty staging DB; the app comes up. To seed, point your LOCAL
   `bun run db:seed` at the staging `DATABASE_URL` (the runner image has no bun/tsx/dev-deps),
   or just create a test workshop via `/register` on staging.
6. **Ruhsat OCR (Claude Vision):** MVP OCR'ı Claude Vision (Sonnet 5) üzerinden çalışır —
   app container'ının içinde, ayrı sidecar YOK. `.env.staging`'e ekle (bir sonraki `dev`
   push'tan ÖNCE — yoksa OCR 500 döner):
   ```
   OCR_PROVIDER=anthropic
   OCR_MODEL=claude-sonnet-5
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   VPS'ten `api.anthropic.com`:443 erişimi gerekir (Resend zaten 443 kullanıyor, sorun yok).
   Tarama başı ~0.02$ (~0.8₺); aynı görsel tekrar taranırsa OcrLog byte-hash cache çağrıyı atlar.
   Not: PaddleOCR sidecar emekliye ayrıldı (`ocr-service/` kodu repoda parked; çevrimdışı
   fallback gerekirse `OCR_PROVIDER=paddle` + ayrı container ile geri getirilir).
7. **RAM:** staging adds ~1.5GB (app 1g + db 512m). (Eski PaddleOCR sidecar'ının ~2-4g'lik
   yükü artık yok — Claude API çağrısı bellek eklemez.)

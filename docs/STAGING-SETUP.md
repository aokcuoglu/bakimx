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
3. **Reverse proxy (getirbakim's Nginx — NOT Caddy):** add an nginx :80/:443 server block for
   `staging.app.bakimx.com` → `bakimx-staging-app:3000` in `/opt/getirbakim/infra/nginx/nginx.production.conf`
   (mirror the existing `app.bakimx.com` block), and issue a Let's Encrypt cert for the host (certbot
   webroot, same as app.bakimx.com), then reload nginx. Add `add_header X-Robots-Tag noindex;` (and
   optionally HTTP basic-auth) so staging isn't indexed/public. DNS record (step 1) is on **Cloudflare**.
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

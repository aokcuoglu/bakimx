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
6. **RAM:** staging adds ~1.5GB (app 1g + db 512m). Confirm headroom on the shared VPS.

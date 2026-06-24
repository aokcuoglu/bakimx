# Staging — one-time VPS/infra setup

Repo side (compose, workflow, env template) is committed. These steps are yours,
done once, before the first `dev` push deploys staging.

1. **DNS:** add an A record `staging.app.bakimx.com` → the VPS IP.
2. **VPS dir:** on the VPS, `mkdir -p /opt/bakimx-staging`; copy `docker-compose.staging.yml`
   there as `docker-compose.yml` (or keep the name and `--file` it); create `.env.staging`
   from `.env.staging.example` with a DISTINCT `SESSION_SECRET`, own DB creds, and
   `SESSION_COOKIE_DOMAIN=staging.app.bakimx.com`, `SESSION_COOKIE_NAME=bakimx_session_staging`.
   Mirror any other prod vars (S3/MinIO etc.), staging-scoped.
3. **Reverse proxy (Caddy):** add a site block routing `staging.app.bakimx.com` →
   `bakimx-staging-app:3000` on the shared `getirbakim_app-network`. Add a
   `header /* X-Robots-Tag noindex` (and optionally `basic_auth`) so staging isn't indexed/public.
4. **GitHub secrets:** none new — `staging.yml` reuses `VPS_HOST` / `VPS_USER` / `VPS_SSH_KEY`.
5. **First deploy:** push `dev` (or run the "Deploy to Staging" workflow). The migrate step
   creates the schema in the empty staging DB; the app comes up. Optionally seed:
   `docker compose --env-file .env.staging run --rm migrate sh -c "bunx tsx prisma/seed.ts"`
   (or run your seed script against the staging DB).
6. **RAM:** staging adds ~1.5GB (app 1g + db 512m). Confirm headroom on the shared VPS.

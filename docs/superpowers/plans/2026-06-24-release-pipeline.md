# Dev/Staging Release Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-protecting release pipeline — `dev`/`main` branches, an auto-applied DB migration gate (one-shot, before app recreate), and a staging environment — so the 2026-06-24 incident class (undeployed work + unsynced migration shipped straight to prod) can't recur.

**Architecture:** Migrations run as a one-shot `migrate` compose service (`prisma migrate deploy`) invoked by the deploy script BEFORE `up -d --force-recreate app`; on failure the script aborts (`set -e`) and the old app keeps running. A new staging stack (`docker-compose.staging.yml` + `staging.yml`) auto-deploys from `dev` to `staging.app.bakimx.com` with its own DB, catching bad migrations before prod. Session cookies become env-scoped so staging can't collide with prod.

**Tech Stack:** Docker Compose, GitHub Actions (appleboy/ssh-action), Prisma 7.8.0 (`migrate deploy`), Next.js standalone runner, Caddy reverse proxy (user side).

## Global Constraints

- **Prod deploy config — high care.** Migrations MUST run BEFORE `up -d --force-recreate app`, and a failure MUST abort the deploy (`set -e`) leaving the old container running — no downtime.
- **No local Docker builds** (project rule: Docker is VPS/prod only). Verification here is `docker compose config` (parse/validate), `bun run typecheck`/`lint`, and YAML validity. The full image build + `migrate` run is first validated on the staging/CI build — NOT locally. State this where it applies.
- **Same image repo** `ghcr.io/aokcuoglu/app`: prod tags `latest` + `vX.Y.Z` + `{major}.{minor}` + `sha`; staging tag `:staging` (+ `sha`).
- **Staging fully isolated from prod:** separate `db-staging` + `pgdata-staging` volume; separate `.env.staging` (own `SESSION_SECRET`, own DB creds); separate session cookie scope.
- **No app behaviour change** except making the session cookie `domain`/`cookieName` env-configurable — the defaults MUST preserve current prod behaviour exactly (`.bakimx.com` / `bakimx_session`).
- **Prisma:** `prisma migrate deploy` (idempotent — applies only pending migrations, never resets). Pin the CLI to `prisma@7.8.0` (matches `package.json`).
- **Commits:** conventional commits; end every commit message with a blank line then `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Do NOT push or deploy from these tasks — rollout is a separate, user-approved step.
- **Branch:** work on `feat/release-pipeline` (already checked out, based on `main`/v0.5.12).

---

### Task 1: Migration gate (prisma CLI in runner + `migrate` service + deploy step)

**Files:**
- Modify: `Dockerfile` (runner stage)
- Modify: `docker-compose.yml` (add `migrate` service)
- Modify: `.github/workflows/deploy.yml` (SSH script)

**Interfaces:**
- Produces: a `migrate` compose service runnable as `docker compose run --rm migrate` → runs `prisma migrate deploy` using the just-pulled `:latest` image against the prod DB. Task 4's staging compose reuses this exact shape.

- [ ] **Step 1: Add the Prisma CLI to the runner image**

In `Dockerfile`, the runner stage (around lines 31–37) copies `public`, `prisma`, and the standalone build but NOT the Prisma CLI. Add a pinned CLI install AFTER the `COPY --from=builder /app/.next/static ...` line and BEFORE `USER nextjs`:

```dockerfile
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma CLI for the one-shot `migrate` service (`prisma migrate deploy` at deploy
# time, before the app is recreated). The Next standalone build omits the CLI; the
# `prisma/` dir (schema + migrations) is already copied above. openssl + libc6-compat
# (installed in `base`) satisfy the Prisma engine on alpine. Pinned to the app's version.
RUN npm install --no-save --no-package-lock prisma@7.8.0

USER nextjs
```

- [ ] **Step 2: Add the one-shot `migrate` service to `docker-compose.yml`**

In `docker-compose.yml`, inside `services:` (e.g. after the `app` service, before `db`), add:

```yaml
  # One-shot DB migration. Run BEFORE recreating `app` at deploy time:
  #   docker compose run --rm migrate
  # `tools` profile keeps it out of `docker compose up`. Idempotent (migrate deploy
  # applies only pending migrations). Uses the same image:tag as `app`.
  migrate:
    image: ghcr.io/aokcuoglu/app:latest
    profiles: ["tools"]
    restart: "no"
    env_file: .env.production
    command: ["npx", "prisma", "migrate", "deploy"]
    depends_on:
      db:
        condition: service_healthy
    networks:
      - internal
```

- [ ] **Step 3: Insert the migrate step into the prod deploy script**

In `.github/workflows/deploy.yml`, the `deploy` job's `script:` (lines ~68–76) currently runs `pull app` then `up -d`. Replace that script body with:

```yaml
          script: |
            set -e
            cd /opt/bakimx
            docker compose --env-file .env.production pull app
            # Apply pending migrations BEFORE recreating the app. `set -e` aborts the
            # whole script on failure, leaving the running app untouched (no downtime).
            docker compose --env-file .env.production run --rm migrate
            docker compose --env-file .env.production up -d app --force-recreate
            # Dangling images only. NEVER an unfiltered `docker system prune` — this VPS
            # also hosts the getirbakim stack.
            docker image prune -f
            echo "Deployed at $(date)"
```

- [ ] **Step 4: Validate compose + workflow statically**

Run:
```bash
docker compose -f docker-compose.yml config >/dev/null && echo "compose OK"
```
Expected: `compose OK` (parses; the `migrate` service is recognized, `tools` profile keeps it out of the default set). If `docker` is unavailable, instead confirm YAML validity with: `bunx yaml-lint docker-compose.yml .github/workflows/deploy.yml` or a manual review — and NOTE in the report that compose validation is deferred to the CI build.

Also eyeball: `migrate` uses `env_file: .env.production`, `command` is `prisma migrate deploy`, deploy script has `set -e` and runs `run --rm migrate` strictly before `up -d`.

> The full image build + an actual `migrate` run can NOT be tested locally (no-local-Docker rule). It is first exercised on the staging build (Task 4) / CI. The abort-on-fail design means a broken migrate fails the deploy safely (old app stays up).

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml .github/workflows/deploy.yml
git commit -m "feat: add one-shot prisma migrate gate before prod app recreate

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Env-scoped session cookie (staging/prod isolation)

**Files:**
- Modify: `src/lib/session.ts:29-42`

**Interfaces:**
- Produces: `sessionOptions.cookieName` and `cookieOptions.domain` now read `SESSION_COOKIE_NAME` / `SESSION_COOKIE_DOMAIN` env vars (defaults preserve prod). Task 4's `.env.staging.example` sets these to staging-scoped values.

- [ ] **Step 1: Make cookie name + domain env-configurable (defaults preserve prod)**

In `src/lib/session.ts`, change the `cookieName` and `domain` lines:

```ts
export const sessionOptions = {
  password: getSessionSecret(),
  cookieName: process.env.SESSION_COOKIE_NAME ?? "bakimx_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    // Prod shares the session across bakimx.com (login) + app.bakimx.com via `.bakimx.com`.
    // Staging overrides SESSION_COOKIE_DOMAIN (its own host) + SESSION_COOKIE_NAME so its
    // cookie never collides with / overwrites prod's. Host-only on localhost dev.
    domain:
      process.env.NODE_ENV === "production"
        ? (process.env.SESSION_COOKIE_DOMAIN ?? ".bakimx.com")
        : undefined,
  },
}
```

- [ ] **Step 2: Typecheck + lint**

Run:
```bash
bun run typecheck && bun run lint
```
Expected: 0 errors (9 pre-existing RHF warnings OK). Defaults are unchanged for prod (`NODE_ENV=production`, no override → `.bakimx.com` / `bakimx_session`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/session.ts
git commit -m "feat: make session cookie name/domain env-configurable for env isolation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: RELEASE.md (release process + checklist)

**Files:**
- Create: `RELEASE.md`

- [ ] **Step 1: Write `RELEASE.md`**

Create `RELEASE.md`:

```markdown
# Release Process

Branches:
- `dev` — integration. All `feature/*` branches PR into `dev`. Every push to `dev`
  auto-deploys to **staging** (https://staging.app.bakimx.com).
- `main` — production mirror. Only staging-verified releases. Tagging `main` deploys prod.

Flow:

    feature/* ──PR──▶ dev ──(auto)──▶ STAGING ──verify──▶ PR dev→main ──tag vX.Y.Z──▶ PROD

## Cutting a release

1. Merge the finished `feature/*` PRs into `dev`.
2. Wait for the **staging** deploy (GitHub Actions → "Deploy to Staging") to go green,
   then smoke-test https://staging.app.bakimx.com — including anything touching the DB
   (migrations are applied to the staging DB automatically before the app restarts).
3. Open a PR `dev → main`. Review the full release diff.
4. Merge to `main`.
5. Bump the version in `package.json` (e.g. `0.5.12` → `0.5.13`) on `main`.
6. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
   The prod deploy (`deploy.yml`) builds the image, **applies pending migrations**
   (one-shot, before recreating the app — a failure aborts the deploy and leaves the
   running app untouched), then recreates the app.

## Migrations

- `deploy.yml` / `staging.yml` run `prisma migrate deploy` (idempotent) via the
  `migrate` compose service BEFORE recreating the app. You do NOT need to run
  migrations by hand.
- A destructive migration that passes empty staging may still fail on prod data —
  review destructive migrations by hand, and consider seeding staging with a
  sanitized prod snapshot for high-risk ones.

## Hotfix

For an urgent prod fix: branch from `main`, PR to `main`, then tag — but still let
staging see it first when at all possible.
```

- [ ] **Step 2: Commit**

```bash
git add RELEASE.md
git commit -m "docs: add RELEASE.md (dev/staging/main release process)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Staging stack (compose + workflow + env template + setup guide)

**Files:**
- Create: `docker-compose.staging.yml`
- Create: `.github/workflows/staging.yml`
- Create: `.env.staging.example`
- Modify: `.gitignore` (allow `.env.staging.example`)
- Create: `docs/STAGING-SETUP.md`

**Interfaces:**
- Consumes: the `migrate` service shape (Task 1) and the env-scoped cookie vars (Task 2).

- [ ] **Step 1: Allow the staging env template through gitignore**

In `.gitignore`, find the env block (`# env files ... .env*` with `!.env.example`) and add a second exception line right after `!.env.example`:

```
# env files (can opt-in for committing if needed)
.env*
!.env.example
!.env.staging.example
```

- [ ] **Step 2: Create `.env.staging.example`**

Create `.env.staging.example`:

```bash
# Staging environment — copy to .env.staging on the VPS at /opt/bakimx-staging and fill.
# MUST differ from prod: own DB creds, own SESSION_SECRET, staging-scoped cookie.

# Postgres (staging db container)
POSTGRES_USER=bakimx_staging
POSTGRES_PASSWORD=__set_a_strong_password__
POSTGRES_DB=bakimx_staging
DATABASE_URL=postgresql://bakimx_staging:__set_a_strong_password__@db:5432/bakimx_staging

# Auth — DISTINCT from prod so staging cookies never validate on prod and vice-versa
SESSION_SECRET=__set_a_distinct_32+_char_secret__
SESSION_COOKIE_NAME=bakimx_session_staging
SESSION_COOKIE_DOMAIN=staging.app.bakimx.com

NODE_ENV=production
# ...plus any other vars present in .env.production (S3/MinIO, etc.) — staging-scoped.
```

- [ ] **Step 3: Create `docker-compose.staging.yml`**

Create `docker-compose.staging.yml`:

```yaml
# Staging stack — lives at /opt/bakimx-staging on the same VPS as prod, fully isolated DB.
# Deployed by .github/workflows/staging.yml on every push to `dev`.
services:
  app:
    image: ghcr.io/aokcuoglu/app:staging
    restart: unless-stopped
    env_file: .env.staging
    deploy:
      resources:
        limits:
          memory: 1g
    depends_on:
      db:
        condition: service_healthy
    networks:
      internal:
      proxy:
        aliases:
          - bakimx-staging-app

  migrate:
    image: ghcr.io/aokcuoglu/app:staging
    profiles: ["tools"]
    restart: "no"
    env_file: .env.staging
    command: ["npx", "prisma", "migrate", "deploy"]
    depends_on:
      db:
        condition: service_healthy
    networks:
      - internal

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512m
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-bakimx_staging}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}
      POSTGRES_DB: ${POSTGRES_DB:-bakimx_staging}
    volumes:
      - pgdata-staging:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-bakimx_staging}"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - internal

volumes:
  pgdata-staging:

networks:
  internal:
  proxy:
    external: true
    name: getirbakim_app-network
```

- [ ] **Step 4: Create `.github/workflows/staging.yml`**

Create `.github/workflows/staging.yml`:

```yaml
name: Deploy to Staging

on:
  push:
    branches: [dev]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository_owner }}/app

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=staging
            type=sha,format=long

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            SESSION_SECRET=build_time_placeholder_at_least_32_chars_long__

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to VPS (staging)
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            set -e
            cd /opt/bakimx-staging
            docker compose --env-file .env.staging pull app
            docker compose --env-file .env.staging run --rm migrate
            docker compose --env-file .env.staging up -d app --force-recreate
            docker image prune -f
            echo "Staging deployed at $(date)"
```

- [ ] **Step 5: Create `docs/STAGING-SETUP.md` (one-time infra checklist — user)**

Create `docs/STAGING-SETUP.md`:

```markdown
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
```

- [ ] **Step 6: Validate staging compose + workflow**

Run:
```bash
docker compose -f docker-compose.staging.yml config >/dev/null && echo "staging compose OK"
```
Expected: `staging compose OK` (the external `getirbakim_app-network` may warn that it's external — that's fine). If `docker` is unavailable, do a YAML-validity check / manual review and note CI as the real gate. Confirm `staging.yml` mirrors `deploy.yml`'s structure (build → `:staging` tag → SSH → `run --rm migrate` before `up -d`).

- [ ] **Step 7: Commit**

```bash
git add .gitignore .env.staging.example docker-compose.staging.yml .github/workflows/staging.yml docs/STAGING-SETUP.md
git commit -m "feat: add staging stack (compose, workflow, env template, setup guide)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Rollout (separate, user-approved — NOT part of the task commits)

After the tasks land and are reviewed:
1. Create `dev` from `main`: `git branch dev main && git push -u origin dev`.
2. Merge `feat/release-pipeline` → `main` (PR or ff) so the migrate gate + cookie change reach prod tooling. (Bootstrap: this first lands without staging.)
3. The next prod tag will auto-apply the pending `20260623000001_add_demo_and_support_requests` migration.
4. Do the §STAGING-SETUP.md infra steps; then `dev` pushes auto-deploy staging.

## Self-Review

**1. Spec coverage:** dev/main model → RELEASE.md (Task 3) + rollout. Auto-migrate one-shot before recreate → Task 1. Staging stack (sep app+DB+subdomain, dev-triggered) → Task 4. Cookie isolation → Task 2. Image tag strategy → Task 1/4. User infra checklist → Task 4 (STAGING-SETUP.md). Recommended follow-ups (bun-install pinning, backups) → left in spec §11, not implemented (out of scope). ✓
**2. Placeholder scan:** `__set_...__` placeholders are intentional fill-ins in a committed `.example` template (not code). No TBD/TODO in code/config steps. ✓
**3. Consistency:** `migrate` service identical shape in prod (Task 1) + staging (Task 4) compose; deploy scripts both `set -e` → `pull` → `run --rm migrate` → `up -d`; cookie env vars (`SESSION_COOKIE_NAME`/`SESSION_COOKIE_DOMAIN`) defined in Task 2, used in Task 4's `.env.staging.example`. ✓

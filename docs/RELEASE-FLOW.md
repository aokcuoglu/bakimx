# Release flow — feature → dev → staging → main → prod

The branching/deploy model. Two long-lived branches, two environments, fully
automated deploys. Both environments live on the same VPS with **separate,
isolated databases** (staging never touches prod data).

```
feature/* ──PR──► dev ──(push)──► 🚀 staging.app.bakimx.com   (auto, every push to dev)
                   │
                   └──PR──► main ──(merge)──► 🚀 app.bakimx.com  (auto, every push to main)
```

## Branches

| Branch    | Purpose                          | Deploys to            | Trigger                        |
| --------- | -------------------------------- | --------------------- | ------------------------------ |
| `dev`     | Integration / QA                 | staging.app.bakimx.com | push → `.github/workflows/staging.yml` |
| `main`    | Production (protected, PR-only)  | app.bakimx.com         | push → `.github/workflows/deploy.yml`  |
| `feature/*` | One change in progress         | —                     | open a PR into `dev`           |

## Day-to-day

1. Branch from `dev`: `git switch dev && git pull && git switch -c feature/x`.
2. Build, commit, open a **PR into `dev`**.
3. Merge to `dev` → staging auto-deploys. **Verify on staging.app.bakimx.com.**
4. When staging looks good, open a **PR `dev` → `main`**.
5. Merge to `main` → production auto-deploys to app.bakimx.com.

`main` is branch-protected: no direct pushes, changes land only via PR. This is
what makes "merge to main = ship to prod" safe — staging is the gate before it.

## What each deploy does (on the VPS)

Both workflows SSH to the VPS and run, against that environment's stack:

```
docker compose pull app          # fetch the freshly built image
docker compose run --rm migrate  # apply pending Prisma migrations (aborts deploy on failure)
docker compose up -d app --force-recreate
```

- **prod**: `/opt/bakimx`, image `ghcr.io/aokcuoglu/app:latest`, DB `bakimx`.
- **staging**: `/opt/bakimx-staging`, image `…/app:staging`, DB `bakimx_staging`.

Migrations run **before** the app is recreated; `set -e` aborts on failure so a
bad migration leaves the running app untouched (no downtime, no half-migrated DB).

## Images & rollback

- prod compose pulls `:latest`; every build also publishes `:sha-<commit>`.
- **Rollback:** repoint prod to a known-good sha and recreate:
  ```
  cd /opt/bakimx
  docker compose pull app    # or: edit image to …/app:sha-<good> then up -d
  docker compose up -d app --force-recreate
  ```
- Version tags (`vX.Y.Z`) are optional record-keeping only — they no longer
  trigger a deploy. Deploys are driven by pushes to `dev`/`main`.

## Admin console access

`/admin` is gated by the `ADMIN_EMAILS` env var (comma-separated) in each
environment's `.env`. If unset, `/admin` returns 404 for everyone. Never put the
public demo account in `ADMIN_EMAILS`. See `.env.production.example`.

## One-time infra (already done — see STAGING-SETUP.md)

DNS, nginx server blocks, TLS certs, `/opt/bakimx-staging` dir + `.env.staging`,
and the GitHub secrets (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`).

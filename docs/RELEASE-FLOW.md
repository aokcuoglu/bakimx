# Release flow — feature → dev → main → prod

The branching/deploy model. Two long-lived branches, two environments, fully
automated deploys. The two environments now live on **different infrastructure**
with **separate, isolated databases** (dev never touches prod data):

- **dev → AWS** — `app-dev.bakimx.com`, ECS Fargate + RDS (eu-central-1). Migrated
  off the old Contabo `staging.app.bakimx.com` on 2026-07-20.
- **main → Contabo VPS** — `app.bakimx.com` (+ landing `bakimx.com`), Docker Compose.
  **Prod → AWS migration is in progress** (separate AWS account `075550799591`): the
  infra is CDK-managed and running, and [`deploy-prod-aws.yml`](../.github/workflows/deploy-prod-aws.yml)
  is wired but **`workflow_dispatch`-only** until DNS cutover. At cutover it flips to
  `main`-push and `deploy.yml` (Contabo) is retired. See [aws-prod-cicd.md](./aws-prod-cicd.md).

```
feature/* ──PR──► dev ──(push)──► 🚀 app-dev.bakimx.com   (AWS ECS, every push to dev)
                   │
                   └──PR──► main ──(merge)──► 🚀 app.bakimx.com  (Contabo VPS, every push to main)
```

## Branches

| Branch      | Purpose                         | Deploys to           | Trigger                                  |
| ----------- | ------------------------------- | -------------------- | ---------------------------------------- |
| `dev`       | Integration / QA                | app-dev.bakimx.com (AWS) | push → `.github/workflows/deploy-dev-aws.yml` |
| `main`      | Production (protected, PR-only) | app.bakimx.com (Contabo) | push → `.github/workflows/deploy.yml`    |
| `feature/*` | One change in progress          | —                    | open a PR into `dev`                     |

`sync-main-to-dev.yml` replays each `main` merge back onto `dev` so dev never
drifts "behind main" (content-neutral in the normal case).

## Day-to-day

1. Branch from `dev`: `git switch dev && git pull && git switch -c feature/x`.
2. Build, commit, open a **PR into `dev`**.
3. Merge to `dev` → AWS dev auto-deploys. **Verify on app-dev.bakimx.com.**
4. When dev looks good, open a **PR `dev` → `main`**.
5. Merge to `main` → production auto-deploys to app.bakimx.com.

`main` is branch-protected: no direct pushes, changes land only via PR. This is
what makes "merge to main = ship to prod" safe — dev is the gate before it.

## What each deploy does

### dev → AWS (`deploy-dev-aws.yml`)
GitHub OIDC → build arm64 image → push to ECR → register a new ECS task-def
revision (image swap) → **DB migration gate** (one-off `ecs run-task` running
`prisma migrate deploy`, aborts the deploy on failure) → `update-service` →
assert the rollout converged on the new task def (fail on circuit-breaker
rollback). See [aws-dev-cicd.md](./aws-dev-cicd.md) for the IAM/OIDC/env details.

### main → Contabo VPS (`deploy.yml`)
SSH to the VPS and run, against `/opt/bakimx`:
```
docker compose pull app          # fetch the freshly built image (ghcr.io/aokcuoglu/app:latest)
docker compose run --rm migrate  # apply pending Prisma migrations (aborts deploy on failure)
docker compose up -d app --force-recreate
```
Migrations run **before** the app is recreated; `set -e` aborts on failure so a
bad migration leaves the running app untouched (no downtime, no half-migrated DB).

## Images & rollback

- **dev (AWS):** ECR `bakimx/app`, tags `dev` + `sha-<commit>`. Rollback: point
  the ECS service at the last-good task-def revision (each carries a pinned
  `sha-…` image) via `aws ecs update-service --task-definition …`.
- **prod (Contabo):** GHCR `ghcr.io/aokcuoglu/app`, `:latest` + `:sha-<commit>`.
  Rollback: repoint prod to a known-good sha and recreate:
  ```
  cd /opt/bakimx
  docker compose up -d app --force-recreate   # after editing image to …/app:sha-<good>
  ```
- Version tags (`vX.Y.Z`) are optional record-keeping only — they no longer
  trigger a deploy. Deploys are driven by pushes to `dev`/`main`.

## Admin console access

`/admin` is gated by the `ADMIN_EMAILS` env var (comma-separated) per environment
(AWS: task-def env / Secrets; Contabo: `.env.production`). If unset, `/admin`
returns 404 for everyone. Never put the public demo account in `ADMIN_EMAILS`.

## Infra references

- **AWS dev:** [aws-dev-cicd.md](./aws-dev-cicd.md) — CI/CD + IAM/OIDC + task-def env (CDK backfill spec).
- **AWS prod:** [aws-prod-cicd.md](./aws-prod-cicd.md) — prod CI/CD + IAM/OIDC + cutover runbook (in progress).
- **Contabo prod (current live):** [../DEPLOY.md](../DEPLOY.md) — VPS runbook (co-hosting, R2/S3, GHCR, DNS, TLS). Retired at cutover.

# Release flow — feature → dev → main → prod

The branching/deploy model. Two long-lived branches, two environments, fully
automated deploys. The two environments now live on **different infrastructure**
with **separate, isolated databases** (dev never touches prod data):

- **dev → AWS** — `app-dev.bakimx.com`, ECS Fargate + RDS (eu-central-1). Migrated
  off the old Contabo `staging.app.bakimx.com` on 2026-07-20.
- **main → AWS** — `app.bakimx.com` (+ landing `bakimx.com`), ECS Fargate + RDS, in a
  **separate AWS account** (`075550799591`). DNS cutover off Contabo: 2026-07-21;
  [`deploy-prod-aws.yml`](../.github/workflows/deploy-prod-aws.yml) runs on every push to
  `main` since 2026-07-26 (before that it was dispatch-only). See [aws-prod-cicd.md](./aws-prod-cicd.md).
  The Contabo VPS stays frozen as a rollback target — rollback is a DNS flip, not a redeploy.

```
feature/* ──PR──► dev ──(push)──► 🚀 app-dev.bakimx.com   (AWS ECS, every push to dev)
                   │
                   └──PR──► main ──(merge)──► 🚀 app.bakimx.com  (AWS ECS, every push to main)
```

## Branches

| Branch      | Purpose                         | Deploys to           | Trigger                                  |
| ----------- | ------------------------------- | -------------------- | ---------------------------------------- |
| `dev`       | Integration / QA                | app-dev.bakimx.com (AWS) | push → `.github/workflows/deploy-dev-aws.yml` |
| `main`      | Production (protected, PR-only) | app.bakimx.com (AWS) | push → `.github/workflows/deploy-prod-aws.yml` |
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

### main → AWS prod (`deploy-prod-aws.yml`)
Identical flow to dev, against the prod account (`075550799591`), cluster
`bakimx-prod-cluster` / service `bakimx-prod-app-svc`. Migrations run in the same
one-off-task gate **before** the service is updated, so a failed migration aborts the
deploy and leaves the running app untouched. Docs-only commits are skipped via
`paths-ignore`; `workflow_dispatch` is kept for manual re-runs and rollbacks.

The Contabo `deploy.yml` (SSH + `docker compose`) stays in the repo but is **frozen
dispatch-only** — its `push: [main]` trigger is commented out, so it cannot fire
alongside the AWS deploy. It is the emergency redeploy path for a VPS rollback; delete
it once the VPS is decommissioned.

## Images & rollback

- **dev (AWS):** ECR `bakimx/app`, tags `dev` + `sha-<commit>`. Rollback: point
  the ECS service at the last-good task-def revision (each carries a pinned
  `sha-…` image) via `aws ecs update-service --task-definition …`.
- **prod (AWS):** ECR `bakimx/app` in account `075550799591`, same tagging. Rollback:
  point the ECS service at the last-good task-def revision, exactly as on dev.
- **prod (Contabo, frozen):** GHCR `ghcr.io/aokcuoglu/app`. Only relevant for a full
  infra rollback — flip the three Cloudflare records back to the VPS IP; the frozen
  stack still serves its last image. `deploy.yml` remains dispatch-only for an
  emergency VPS redeploy after such a rollback.
- Version tags (`vX.Y.Z`) are optional record-keeping only — they only create a GitHub
  Release (`release.yml`) and never deploy. Deploys are driven by pushes to `dev`/`main`.

## Admin console access

`/admin` is gated by the `ADMIN_EMAILS` env var (comma-separated) per environment
(AWS: task-def env / Secrets; Contabo: `.env.production`). If unset, `/admin`
returns 404 for everyone. Never put the public demo account in `ADMIN_EMAILS`.

## Infra references

- **AWS dev:** [aws-dev-cicd.md](./aws-dev-cicd.md) — CI/CD + IAM/OIDC + task-def env (CDK backfill spec).
- **AWS prod:** [aws-prod-cicd.md](./aws-prod-cicd.md) — prod CI/CD + IAM/OIDC + cutover runbook (cutover done 2026-07-21).
- **Contabo prod (frozen rollback target):** [../DEPLOY.md](../DEPLOY.md) — VPS runbook (co-hosting, R2/S3, GHCR, DNS, TLS). No longer the live path.

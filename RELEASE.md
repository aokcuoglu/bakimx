# Release Process

Branches:
- `dev` — integration. All `feature/*` branches PR into `dev`. Every push to `dev`
  auto-deploys to **app-dev.bakimx.com** (AWS ECS).
- `main` — production mirror (AWS ECS, account 075550799591). Only app-dev-verified releases.

Flow:

    feature/* ──PR──▶ dev ──(auto)──▶ APP-DEV (AWS) ──verify──▶ PR dev→main ──manual dispatch──▶ PROD

> **Tagging does NOT deploy prod.** Since the 2026-07-21 AWS cutover the prod deploy is
> `deploy-prod-aws.yml` on `workflow_dispatch` only; the old Contabo `deploy.yml` has its
> `push: [main]` trigger commented out. A `vX.Y.Z` tag push only triggers `release.yml`,
> which creates the GitHub Release from `docs/releases/<tag>.md`. Prod is a deliberate,
> separate button press.

## Cutting a release

1. Merge the finished `feature/*` PRs into `dev`.
2. Wait for the **app-dev** deploy (GitHub Actions → "Deploy to AWS dev") to go green,
   then smoke-test https://app-dev.bakimx.com — including anything touching the DB
   (migrations are applied to the dev DB automatically before the app restarts).
3. Bump the version in `package.json` (e.g. `0.8.0` → `0.9.0`) **on `dev`**, and write
   `docs/releases/vX.Y.Z.md` — `release.yml` uses that file verbatim as the Release body.
   Add the version to `CHANGELOG.md`.
4. Open a PR `dev → main`. Review the full release diff.
5. Merge to `main`. (`sync-main-to-dev.yml` replays the merge commit back onto `dev`.)
6. Tag the merge commit on `main` and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
   This creates the GitHub Release. Nothing is deployed yet.
7. Deploy prod by hand: GitHub Actions → **"Deploy to AWS prod"** → Run workflow (`main`).
   It builds the image, registers a new task-def, runs the **migration gate** (one-off ECS
   task; a failure aborts the deploy and leaves the running app untouched), seeds the
   vehicle catalog (non-blocking), then updates the ECS service and asserts the new
   task-def actually converged.

   Before pressing it, confirm the prod runtime env has `APP_URL`, `RESEND_*`,
   `ADMIN_EMAILS` and `TRIAL_PURGE_CUTOFF` set.

## Migrations

- `deploy-prod-aws.yml` and `deploy-dev-aws.yml` both run `prisma migrate deploy`
  (idempotent) as a one-off `ecs run-task` BEFORE updating the service. You do NOT need to
  run migrations by hand. (`deploy.yml` is the frozen Contabo rollback path and no longer
  runs on its own.)
- A destructive migration that passes an empty app-dev may still fail on prod data —
  review destructive migrations by hand, and consider seeding app-dev with a
  sanitized prod snapshot for high-risk ones.

## Hotfix

For an urgent prod fix: branch from `main`, PR to `main`, tag, then dispatch the prod
deploy — but still let app-dev see it first when at all possible.

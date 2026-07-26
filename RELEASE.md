# Release Process

Branches:
- `dev` — integration. All `feature/*` branches PR into `dev`. Every push to `dev`
  auto-deploys to **app-dev.bakimx.com** (AWS ECS).
- `main` — production mirror (AWS ECS, account 075550799591). Only app-dev-verified releases.

Flow:

    feature/* ──PR──▶ dev ──(auto)──▶ APP-DEV (AWS) ──verify──▶ PR dev→main ──(auto)──▶ PROD

> **Merging to `main` deploys prod.** Since 2026-07-26 `deploy-prod-aws.yml` runs on every
> push to `main`, so the dev→main PR merge IS the release button. (Between the 2026-07-21
> cutover and that date it was dispatch-only, which produced merges that silently shipped
> nothing.) Docs/release-note-only commits are skipped via `paths-ignore`.
>
> **Tagging still does NOT deploy.** A `vX.Y.Z` tag push only triggers `release.yml`, which
> creates the GitHub Release from `docs/releases/<tag>.md`.

## Cutting a release

1. Merge the finished `feature/*` PRs into `dev`.
2. Wait for the **app-dev** deploy (GitHub Actions → "Deploy to AWS dev") to go green,
   then smoke-test https://app-dev.bakimx.com — including anything touching the DB
   (migrations are applied to the dev DB automatically before the app restarts).
3. Bump the version in `package.json` (e.g. `0.8.0` → `0.9.0`) **on `dev`**, and write
   `docs/releases/vX.Y.Z.md` — `release.yml` uses that file verbatim as the Release body.
   Add the version to `CHANGELOG.md`.
4. Open a PR `dev → main`. Review the full release diff.
5. Merge to `main`. **This starts the prod deploy** (~11–12 min): build → new task-def →
   **migration gate** (one-off ECS task; a failure aborts the deploy and leaves the running
   app untouched) → vehicle-catalog seed (non-blocking) → ECS service update → assert the
   new task-def actually converged. (`sync-main-to-dev.yml` replays the merge commit back
   onto `dev` in parallel.)

   Before merging, confirm the prod runtime env has `APP_URL`, `RESEND_*` and
   `ADMIN_EMAILS` set.
6. Watch it: GitHub Actions → **"Deploy to AWS prod"**, or `gh run watch <id> --exit-status`.
   Smoke-test https://app.bakimx.com once it is green.
7. Tag the merge commit on `main` and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
   This creates the GitHub Release only — it does not deploy.

## Migrations

- `deploy-prod-aws.yml` and `deploy-dev-aws.yml` both run `prisma migrate deploy`
  (idempotent) as a one-off `ecs run-task` BEFORE updating the service. You do NOT need to
  run migrations by hand. (`deploy.yml` is the frozen Contabo rollback path, dispatch-only;
  rollback to the VPS is a DNS flip, not a redeploy.)
- A destructive migration that passes an empty app-dev may still fail on prod data —
  review destructive migrations by hand, and consider seeding app-dev with a
  sanitized prod snapshot for high-risk ones.

## Hotfix

For an urgent prod fix: branch from `main`, PR to `main`, merge — the merge deploys. Tag
afterwards. Still let app-dev see it first when at all possible.

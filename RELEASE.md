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

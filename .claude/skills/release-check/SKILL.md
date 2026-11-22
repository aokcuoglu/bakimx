---
name: release-check
description: Show what is on dev but not yet on main in BakımX, check release readiness (migrations, env, tenancy, gates), propose the next SemVer version and scope, and — only after the user's explicit approval — prepare the versioned dev → main release (version + notes PR into dev, dev → main PR, merge = automatic production deploy, watch it, tag). Use for "/release-check", "sürüm çıkaralım mı?", or before any change to main.
---

Policy: `docs/releasing.md` (Sürüm çıkarma) and `docs/agent-workflows/repo-guardrails.md` §2/§6. Releases are batched on `dev`; never suggest one per delivery. Talk to the user in Turkish.

## 1. State (read-only)
- `git fetch origin --tags`; last release `git describe --tags --abbrev=0 origin/main`; `package.json` version on `origin/dev`.
- Scope: `git log --first-parent --format='%h %s' origin/main..origin/dev` and merged PRs since the last release (`gh pr list --state merged --base dev --search "merged:>=<last release date>" --json number,title`).
- Impact: any `feat` → MINOR; only `fix`/`perf`/`copy` → PATCH; MAJOR only if the user asks. Docs/CI alone do not need a release.
- Readiness (from the old release check): migrations in scope (`git diff --name-only <last-tag> origin/dev -- prisma/migrations`) and whether each is backward compatible during the rolling deploy; new env variables (`git diff <last-tag> origin/dev -- .env.example src/lib/env*`) — they must exist in the prod task definition / SSM before merge; auth/session, tenant isolation and billing changes; dependency changes; `quality` green on the `dev` head.
- Read the top of `CHANGELOG.md` and an existing `docs/releases/v*.md` (keep the format).

## 2. Proposal and APPROVAL
Show the user: current version → proposed `vX.Y.Z`, PR list, migrations/env/operations steps, work not ready (half-done feature, pending console step). **Ask for explicit approval** (AskUserQuestion), including whether to deploy app-dev first for shared verification (manual dispatch of *Deploy to AWS dev*; the guard asks). Without approval stop here. Approval for one release does not cover the next.

## 3. Preparation (after approval)
1. A `chore(release): vX.Y.Z` Issue under `/issue` rules; worktree `../bakimx-<N>` branch `issue/<N>-release-vX-Y-Z` from origin/dev.
2. Bump `package.json` version, write `docs/releases/vX.Y.Z.md` (`release.yml` uses it verbatim as the GitHub Release body) and the `CHANGELOG.md` section: features, fixes, Issue/PR links, migrations and operations steps.
3. PR → `dev`, CI green, squash-merge (normal `/ship` steps 6–7).
4. `gh pr create --base main --head dev --title "chore(release): vX.Y.Z"` — scope and verification in the body. Wait for and verify `quality` with the `/ship` step 6 gate (main also requires an up-to-date branch). Then `gh pr merge <PR> --merge` — a merge commit, **never** `--delete-branch` (dev is permanent; repo-guardrails §2.5). The guard asks; the user already approved — show version and scope again.
5. **Merging into main deploys production** (`deploy-prod-aws.yml`, push to main, ~12 min: build → task-def → migration gate → catalog seed → ECS update). Do not dispatch it again. Watch: `gh run list --workflow deploy-prod-aws.yml --branch main --limit 1` → `gh run watch <id> --exit-status`. Then smoke-test https://app.bakimx.com (login page, `/api/health`, one authenticated page if the user provides access).
6. Tag the main merge commit: `git tag vX.Y.Z <merge-sha> && git push origin vX.Y.Z` (the guard asks). `release.yml` creates the GitHub Release from `docs/releases/vX.Y.Z.md`; do not run `gh release create`. Never move or delete an existing tag.
7. `sync-main-to-dev.yml` merges main back into dev automatically; once it is green, fast-forward the primary checkout: `git -C /Users/void/www/bakimx fetch origin && git -C /Users/void/www/bakimx merge --ff-only origin/dev`.
8. Report: release PR, merge commit, deploy run result, smoke test, tag, Release link.

## Rules
- Hotfix: branch from `main`, PR into `main` — still only with the user's explicit approval (it deploys).
- Never change deploy workflows, task definitions or SSM parameters as part of a release without a separate request.

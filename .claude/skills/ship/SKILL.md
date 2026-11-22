---
name: ship
description: Orchestrate one BakımX development end to end — issue → worktree from origin/dev → plan → implement → code + UI review → QA → PR into dev → CI → squash-merge into dev → fast-forward the primary checkout (localhost:3001) → close issue, sync board, clean up. Use for "/ship 489", "/ship <description>", or whenever the user asks to implement, fix, develop or deliver a GitHub issue in BakımX.
argument-hint: <issue number | short description>
---

You are the **orchestrator** (squad role: Atlas) of one BakımX development. You coordinate the `bakimx-*` agents; you do not write product code yourself (small glue work is fine). Rules are in `AGENTS.md`, `CLAUDE.md` and the agent files; the tool-neutral contract is `docs/agent-workflows/issue-delivery.md` — do not re-read it unless a step below is unclear. Give the user a one-line Turkish update at every stage change.

Argument: `$ARGUMENTS` — Issue number or description (then first open an Issue under `/issue` rules).

## 0. Preconditions
- Primary checkout `/Users/void/www/bakimx` (branch `dev`, serves localhost:3001). Do not touch other sessions' uncommitted work, local-only commits or worktrees (the session brief lists them). `git fetch origin`.
- `gh issue view <N> --comments`; stop if it is closed, already has an active PR, or needs a product decision you cannot infer. Derive `<type>` (feat|fix|perf|refactor|docs|chore|copy|test), `<slug>` (kebab, ≤5 words) and the Multica key (`BAK-x`) if the issue or user names one — never invent it.
- `git worktree list` + `gh pr list`: if a branch/worktree/PR already exists for the Issue, inspect it and stop rather than assuming ownership.
- Make sure the issue is on the `Factory - BakimX` project (add as Todo if missing; In Progress when work starts, if permissions allow).

## 1. Worktree
```
git worktree add -b issue/<N>-<slug> ../bakimx-<N> origin/dev
bun run worktree:env -- ../bakimx-<N>      # links the primary's .env.local (never copy, never edit it)
cd ../bakimx-<N> && bun install             # real node_modules (~3 s); Turbopack rejects a symlink
```
Inside Herdr (`HERDR_ENV=1`) create it with `herdr worktree create --branch issue/<N>-<slug> --base origin/dev --path ../bakimx-<N>` instead, then the last two lines. `WT=/Users/void/www/bakimx-<N>`; give this path to every agent.

## 2. Plan
Call `bakimx-planner` with the Issue no + `WT` (skip for a small one-file fix). The plan is the developer's brief and the QA route list. If the plan says "too big", open the follow-up Issues now and continue with the first slice.

## 3. Implement
Call `bakimx-developer` with `WT`, the Issue no, the full plan and the commit trailer from the system reminder. Default sonnet; pass `model: "opus"` for Prisma schema/migrations, auth/session/RBAC, billing/payments (TAMI), tenant-isolation-sensitive queries, cross-area refactors, or sonnet work still failing after two review rounds. Read **Checks** (and their SHA), **Migration** and **Not done**; pass Checks and SHA verbatim to the reviewers and QA; send a failed check back to the same agent via SendMessage (do not open a new agent).

## 4. Review
For a small UI-only change (≤2 `.tsx`/`.css` files; no `prisma/`, `src/lib/`, `actions.ts`, `route.ts`, auth/billing/tenancy touch) call only `bakimx-ui-ux` (`WT` + QA routes). Otherwise, in parallel in one message:
- `bakimx-reviewer` (`WT`).
- `bakimx-ui-ux` (`WT` + QA routes) — only if `.tsx`/`.css` changed.
Send 🔴 and 🟡 findings to the developer → in the fix round ask the same reviewer via SendMessage about the fixed items only. At most two fix rounds; then report the rest to the user.

## 5. QA
If a route/component changed, call `bakimx-qa` with `WT`, the planned routes/roles, the Issue's acceptance criteria, the checks' SHA and whether there is a migration (isolated DB). Only one browser QA at a time (single Chrome). ❌ → one round with the developer, then the user.

## 6. PR
CI is the final deterministic gate. In `WT`:
- `git status` clean; commits conventional; `git fetch origin && git merge origin/dev` (the developer resolves conflicts); if the merge brought new commits, rerun `bun run typecheck && bun test`; read `git diff origin/dev --stat` for unexpected deletions; `git push -u origin issue/<N>-<slug>`.
- `gh pr create --base dev --title "<type>(#<N>): <summary>" --body-file -` following `.github/pull_request_template.md` (Özet, Değişiklik türü, Etki alanları / risk, Şema / migration, Kontroller with review/QA verdicts, Manuel QA adımları) and ending with the closing lines — `Closes #<N>`, plus `Closes <BAK-x>` when Multica tracks it — then the attribution line from the system reminder. Not draft, no `ci` label needed.
- CI gate (never skip): run `gh pr checks <PR> --watch --fail-fast` **unpiped** (a pipe swallows the exit code). Right before merge verify:
  ```
  gh pr view <PR> --json statusCheckRollup -q '([.statusCheckRollup[] | select(.name=="quality") | .conclusion] | index("SUCCESS") != null) and ([.statusCheckRollup[] | .conclusion] | all(. == "SUCCESS" or . == "NEUTRAL" or . == "SKIPPED"))'
  ```
  If the output is not `true`, NO merge. A failure caused by this PR: give `gh run view <run> --log-failed` to the developer, fix, push, wait again. An unrelated flaky failure: open an Issue (`Found in #<PR>`), note it on the PR, and ask the user before re-running (the guard asks for `gh run rerun`).

## 7. Merge and cleanup (without asking — the standing merge authority covers it)
1. Gate `true` + `gh pr view <PR> --json mergeable,baseRefName,isDraft` (base `dev`, mergeable, not draft) →
   `gh pr merge <PR> --squash --subject "<PR title> (#<PR>)" --body "<one-line summary>"` — always pass `--body` (the repository default pastes every commit message). Add `[deploy-dev]` to the body **only** when the PR adds a migration (repo-guardrails §6); never mention the marker otherwise. Do not use `--delete-branch` from a worktree; delete the remote branch afterwards: `git push origin --delete issue/<N>-<slug>`.
2. The default branch is `main`, so `Closes #N` does not fire on a dev merge: `gh issue close <N> --comment "dev'e merge edildi: #<PR>"`. Then `bun run project:sync` and confirm the card is Done (and the Multica issue lists the PR, if any).
3. Update the primary checkout so localhost:3001 shows the result: `git -C /Users/void/www/bakimx fetch origin && git -C /Users/void/www/bakimx merge --ff-only origin/dev`. If the fast-forward fails (local-only commits on dev or a blocking uncommitted file), do NOT reset, stash or merge — tell the user exactly what blocks it (the session brief shows it). Do not kill the dev server on 3001; if `bun.lock` changed run `bun install` in the primary and `touch next.config.ts` (Next restarts itself); if `prisma/schema.prisma` changed, the post-merge hook regenerates the client — tell the user to restart `bun run dev`.
4. Remove only this work's resources: stop your QA server/container if still running; `git worktree remove ../bakimx-<N>` (clean) + `git branch -D issue/<N>-<slug>` + `git fetch --prune`. Never `git worktree prune`, wildcard branch deletion or `git clean`.
5. Report (Turkish): Issue and PR links, one-paragraph summary, review/QA verdicts, CI result, merge commit, whether localhost:3001 now shows it, operations step, migration/`[deploy-dev]`, out-of-scope items (with follow-up Issues opened). Do not suggest a production release per delivery — releases are batched on dev (`/release-check` only when the user asks).

## Rules
- No commits on `dev`/`main`; never merge feature branches into local `dev`; push to main, dev → main merge (= production deploy), version tags, workflow dispatch — only in the `/release-check` flow with the user's explicit approval.
- Do not widen scope. Other work you discover becomes a new Issue (first `gh issue list --search`), body `Found in #N`.
- Protect other worktrees, branches, uncommitted work and local-only commits in the primary checkout, and the dev server on 3001.

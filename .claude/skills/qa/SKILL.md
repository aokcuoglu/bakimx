---
name: qa
description: Run the BakımX QA pass (harness:gates, typecheck, lint, tests, then a Chrome walk of the given routes on mobile and desktop on a short-lived 32NN worktree server) via the bakimx-qa agent. Use for "/qa", "/qa <issue|worktree> <routes>", or when a change must be verified in the real app before review/merge.
argument-hint: [worktree path | issue no] [routes…]
---

Arguments: `$ARGUMENTS`

1. Find the worktree: explicit path, Issue number (`/Users/void/www/bakimx-<N>` or the branch containing `/<N>-` in `git worktree list`), or the current directory (if its branch is not `dev`/`main`). If only the primary checkout exists, stop and ask which worktree to test — localhost:3001 already shows `dev`.
2. Build the route list: from the arguments; otherwise from the branch's changed files (`git diff --name-only origin/dev...HEAD` → `src/app/<path>/page.tsx` → `/<path>`, drop group folders like `(app)`, find a real record for `[id]`). If the Issue number is known, add its acceptance criteria. Note whether the branch adds a migration (`git diff --name-only origin/dev...HEAD -- prisma/migrations`).
3. Call `bakimx-qa` with the worktree path, routes, roles (app pages → owner, `/technician` → technician, `/s/`, `/p/`, `/w/` token pages → public) and acceptance criteria. Standalone, the checks still run; inside `/ship` they may be skipped by the SHA in the brief.
4. Relay the QA report to the user (table + verdict, summary in Turkish, the preview URL if the server is still running). Inside `/ship` with a ❌ verdict, send the blockers to the developer agent; otherwise leave it to the user.

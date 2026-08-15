---
name: bakimx-issue-delivery
description: Deliver BakimX GitHub issues end to end from analysis through isolated coding, tests, PR, Actions, merge, issue and project closure, safe cleanup, and local dev synchronization. Use when the user gives an issue number and asks to implement, fix, develop, ship, or complete it.
---

# BakimX Issue Delivery

Read and follow `AGENTS.md`, `docs/agent-workflows/issue-delivery.md`, and
`docs/agent-workflows/repo-guardrails.md` completely before acting.

## Required sequence

1. Fetch the issue, comments, attachments, project status, and linked work. Add a
   missing issue to Factory - BakimX as Todo, then move it to In Progress.
2. Define testable acceptance criteria and non-goals.
3. Create an isolated `issue/<number>-<slug>` branch/worktree from `origin/dev`.
4. Implement a focused solution with regression coverage.
5. Merge the latest `origin/dev` into the branch, then run targeted checks, full
   tests, lint, typecheck, build, and relevant UI QA on the merged result. A PR's
   green check only proves its head commit was green.
6. Review the final diff for security, tenant isolation, accessibility, performance,
   migrations, secrets, and scope. Check `git diff origin/dev --stat` for files you
   never touched being deleted — that is the stale-branch signature (PR #341).
7. Push and open a PR to `dev` with the closing lines its trackers need:
   `Closes #<number>` for GitHub, plus `Closes <MULTICA-KEY>` when Multica also
   tracks the work. Those keywords are the only PR-to-issue links you create —
   never link a PR from the issue's Development panel after the issue is closed;
   it makes project automation overwrite `Done`.
8. Monitor Actions and reviews; merge only when every required gate is green.
9. Verify the issue is closed, then run `bun run project:sync` and confirm
   Factory - BakimX shows Done.
10. Remove only resources created by this task; fast-forward local `dev` only when
    its checkout is clean.

Never overwrite, stash, reset, clean, commit, or delete unrelated user work.

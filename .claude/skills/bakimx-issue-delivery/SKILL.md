---
name: bakimx-issue-delivery
description: Deliver BakimX GitHub issues end to end from analysis through isolated coding, tests, PR, Actions, merge, issue and project closure, safe cleanup, and local dev synchronization. Use when the user gives an issue number and asks to implement, fix, develop, ship, or complete it.
---

# BakimX Issue Delivery

Read and follow `AGENTS.md` and `docs/agent-workflows/issue-delivery.md`
completely before acting.

## Required sequence

1. Fetch the issue, comments, attachments, project status, and linked work. Add a
   missing issue to Factory - BakimX as Todo, then move it to In Progress.
2. Define testable acceptance criteria and non-goals.
3. Create an isolated `issue/<number>-<slug>` branch/worktree from `origin/dev`.
4. Implement a focused solution with regression coverage.
5. Run targeted checks, full tests, lint, typecheck, build, and relevant UI QA.
6. Review the final diff for security, tenant isolation, accessibility, performance,
   migrations, secrets, and scope.
7. Push and open a PR to `dev` with `Closes #<number>` in its body.
8. Monitor Actions and reviews; merge only when every required gate is green.
9. Verify the issue is closed and Factory - BakimX shows Done.
10. Remove only resources created by this task; fast-forward local `dev` only when
    its checkout is clean.

Never overwrite, stash, reset, clean, commit, or delete unrelated user work.

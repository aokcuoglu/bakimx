---
name: bakimx-issue-delivery
description: Deliver BakimX GitHub issues end to end from issue analysis through isolated implementation, testing, pull request, green checks, merge, issue and project closure, safe branch/worktree cleanup, and local dev synchronization. Use when the user gives a GitHub issue number and asks Codex to implement, fix, develop, ship, or complete it.
---

# BakimX Issue Delivery

Follow the repository's canonical workflow in
`docs/agent-workflows/issue-delivery.md`. Read it completely before taking task
actions, together with `AGENTS.md` and the relevant installed Next.js guide.

## Workflow

1. Fetch the issue, comments, attachments, project state, and linked PRs. Add a
   missing issue to Factory - BakimX as Todo, then move it to In Progress.
2. State acceptance criteria and identify blockers before editing.
3. Create an isolated issue branch/worktree from the latest `origin/dev`; preserve
   every unrelated local change and worktree.
4. Implement the smallest complete solution and add regression coverage.
5. Run targeted checks, then tests, lint, typecheck, and build. Perform browser QA
   for affected UI flows.
6. Self-review the diff, commit only issue-owned changes, and open a PR to `dev`
   whose body includes `Closes #<number>`.
7. Monitor Actions and reviews, fix branch-caused failures, and merge only when all
   repository gates and active authorization policies permit it.
8. Verify issue closure and Factory - BakimX Status Done.
9. Remove only resources created for this issue. Fast-forward local `dev` only if
   its checkout is clean.

## GitHub routing

- Use the available GitHub integration for issue and PR context.
- Use the repository's GitHub publish, CI, and review skills when their trigger
  applies.
- Use `gh` for Projects v2, Actions logs, worktree-aware operations, and connector
  gaps. Never bypass required checks or branch protection.

## Guardrails

- Do not infer product decisions that materially change scope.
- Do not touch dirty user state or unrelated worktrees.
- Do not declare success from local checks alone; observe remote checks and merge.
- Do not claim deployment, issue closure, Done state, cleanup, or local sync without
  verifying each one.

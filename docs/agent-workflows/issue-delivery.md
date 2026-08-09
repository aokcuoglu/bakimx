# GitHub Issue Delivery Contract

This is the canonical, tool-neutral workflow for Codex, Claude Code, and human
contributors delivering a BakimX GitHub issue. Repository-specific instructions
in `AGENTS.md` remain mandatory.

## Trigger and completion contract

Apply this workflow when a user provides an issue number and asks to implement,
fix, develop, or deliver it. Unless the user limits the scope, completion means:

1. Understand the issue and define testable acceptance criteria.
2. Implement the smallest complete solution in an isolated worktree.
3. Validate and review the change in proportion to its risk.
4. Push a branch and open a PR that closes every tracker the work is filed in:
   `Closes #<github-number>`, plus `Closes <MULTICA-KEY>` when a Multica issue
   drives the delivery.
5. Monitor required GitHub Actions, fix failures, and merge only when green.
6. Verify the issue is closed and its Factory - BakimX project item is Done.
7. Remove only the branch/worktree created for the issue.
8. Fast-forward the primary local `dev` checkout only when it is clean.

Respect the active agent's authorization and confirmation policies. Never bypass
branch protection, required reviews, required checks, or repository permissions.

## 1. Intake and understanding

- Resolve the repository from the checkout and fetch the issue, comments,
  attachments, labels, milestone, linked PRs, and project state.
- Stop if the issue is closed, already has an active implementation PR, targets
  a different repository, or contains a material product decision that cannot be
  inferred safely.
- Translate the request into explicit acceptance criteria, affected flows,
  non-goals, edge cases, and observable success conditions.
- Inspect the current implementation, tests, recent relevant history, and local
  conventions before proposing changes.
- For Next.js work, read the relevant installed guide under
  `node_modules/next/dist/docs/` before editing code.
- Ensure the issue is in `Factory - BakimX`; if missing, add it as Todo. Move it
  to In Progress when work starts if project permissions allow it.

## 2. Workspace isolation

- Start from the latest `origin/dev`, never from a stale local branch.
- Use branch `issue/<number>-<short-kebab-slug>` in a dedicated worktree.
- Record the exact branch and worktree path created by the session.
- Do not reuse, delete, prune, reset, stash, or modify any unrelated branch,
  worktree, untracked file, or dirty checkout.
- If the intended branch already exists, inspect it and stop rather than assuming
  ownership.

Example shape (choose a unique path outside active worktrees):

```sh
git fetch origin dev
git worktree add -b issue/123-short-slug <safe-path> origin/dev
```

## 3. Plan and implementation

- Write a short implementation plan mapped to the acceptance criteria.
- Prefer a focused change over broad refactoring. Follow existing architecture,
  type boundaries, naming, and UI primitives.
- Preserve tenant isolation, authorization, server-side validation, accessibility,
  mobile UX, error/loading/empty states, and observability.
- Add or update tests for changed behavior. A bug fix should include a regression
  test when practical.
- Use a Prisma migration for schema changes; never use `db:push` as a delivery
  mechanism. Explain compatibility and rollback considerations.
- Do not add dependencies, secrets, generated artifacts, or unrelated formatting
  without a demonstrated need.

## 4. Quality gates

Run the narrowest useful checks early, then the repository gates before PR:

```sh
bun test
bun run lint
bun run typecheck
bun run build
```

- Run relevant targeted tests first and the full suite before delivery.
- For Prisma changes, also run `bun run db:validate` and validate the migration.
- For UI changes, verify the affected flow at desktop and mobile widths using the
  available browser tooling; cover keyboard interaction and error/empty/loading
  states where relevant.
- Review the final diff for correctness, security, privacy, tenant isolation,
  performance, accessibility, migrations, accidental secrets, and scope creep.
- Do not weaken tests, lint, types, or CI to make a failing change pass.
- If a gate is unavailable or fails for a pre-existing reason, collect evidence,
  distinguish it from regressions, and do not claim full success.

## 5. Commit and pull request

- Keep commits intentional and limited to issue-owned files.
- Use a descriptive commit such as `fix(#123): correct intake validation`.
- Rebase or merge the latest `origin/dev` before the final validation when the
  branch has drifted; never force-push shared work without explicit authorization.
- Push the issue branch and open a PR targeting `dev`.
- Complete the PR template. Include summary, risks, tests and manual QA evidence.
- Link the PR from its body, not only from a commit or comment. Work that is
  tracked in both systems needs **two closing lines**, one per tracker:

  ```text
  Closes #123
  Closes BAK-7
  ```

  - `Closes #<github-number>` closes the GitHub issue on merge.
  - `Closes <MULTICA-KEY>` links the PR to the Multica issue and moves it to Done
    on merge. The key is the identifier Multica prints on the issue (`BAK-7`),
    not its UUID.
  - The two lines are not interchangeable and neither implies the other. A missing
    GitHub line leaves the GitHub issue open; a missing Multica line leaves the
    Multica issue unlinked, so its status has to be fixed by hand after every merge.
- Put the Multica key where the connector can see it. It scans the PR **title,
  branch name, and body**, but a key in the body only becomes a visible link when
  it directly follows a closing keyword (`Closes` / `Fixes` / `Resolves`). A bare
  key mentioned in prose is recorded as `reference_only` and never appears in the
  Multica issue's Pull requests panel.
- When a delivery has no Multica issue — the work started straight from a GitHub
  issue — write the GitHub line only. Never invent a Multica key.
- Start as draft while checks or review work remain; mark ready only when the
  implementation and evidence are complete.

## 6. Checks, review, and merge

- Monitor every required check to a terminal state. Inspect logs and fix failures
  attributable to the branch; rerun proportionate local validation after fixes.
- Resolve actionable review comments and re-check the diff.
- Merge only when the PR is non-draft, mergeable, approved as required, current
  with `dev`, and all required checks are green.
- Prefer squash merge unless repository policy or release history requires a
  different method. Never use admin bypass.
- A deployment workflow triggered after merge is distinct from PR validation.
  Report its status; do not claim deployment success before it completes.

## 7. Closure and project automation

- Confirm the merged PR contains the closing keyword and GitHub closed the issue.
- Confirm the issue item in `Factory - BakimX` has Status `Done`.
- When the delivery is tracked in Multica, confirm the Multica issue lists the PR
  in its Pull requests panel and moved to Done on merge. An empty panel means the
  key never registered as a link — fix it on the next PR, not by hand-linking this
  one.
- GitHub Projects' built-in workflow should set closed issues and merged PRs to
  Done. If it does not, inspect the project workflow configuration and report the
  failure; update the item manually only when authorized.
- Do not close an issue manually before merge merely to make the board look done.
- **Link the PR to the issue when the PR is opened, never after it is closed.**
  The `Closes` lines in the PR body create both links at the right moment. Adding a
  link from the issue's Development panel after the issue is already closed makes
  project automation overwrite `Done` with an in-progress status, and `Item closed`
  never fires again to correct it. On 2026-08-01 this stranded 14 closed issues in
  In Progress; the `Pull request linked to issue` workflow was disabled as a result.
- Close the delivery by reconciling the board, which is idempotent and safe to run
  at any time:

```sh
bun run project:sync              # closed issue -> Status Done
bun run project:sync -- --dry-run # report drift without changing anything
```

## 8. Cleanup and local synchronization

- Delete only the remote issue branch when it is merged and no longer needed.
- Remove only the worktree created for this issue, then delete only its local
  branch. Verify targets exactly before either operation.
- Never use broad cleanup commands such as `git worktree prune`, wildcard branch
  deletion, `git clean`, or `git reset --hard` as routine cleanup.
- Update the primary local checkout only when it is on `dev`, has no staged,
  unstaged, or untracked changes, and can fast-forward:

```sh
git fetch origin dev
git pull --ff-only origin dev
```

- If the primary checkout is dirty or cannot fast-forward, leave it untouched and
  report the exact blocker and the already-merged commit.

## Final report

Report the issue, branch, PR, merge commit, checks run, Actions/deployment state,
issue/project state, cleanup performed, and whether local `dev` was updated. List
any skipped or failing verification explicitly.

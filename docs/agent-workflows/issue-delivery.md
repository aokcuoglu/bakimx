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
4. Push and open a PR into `dev` that closes every tracker: `Closes
   #<github-number>`, plus `Closes <MULTICA-KEY>` when a Multica issue drives the
   delivery. `quality` runs on every PR.
5. Wait for a green `quality`, fix failures, and squash-merge — no separate human
   approval (see "Merge yetkisi" below). "commit + PR" stops after step 4 only when
   the user says so.
6. Close the GitHub issue (a `dev` merge does not fire `Closes`, the default
   branch is `main`) and verify its Factory - BakimX project item is Done.
7. Fast-forward the primary checkout to `origin/dev` so localhost:3001 shows the
   result, then remove the issue worktree and branch.

**`origin/dev` is the only integration point** (since #789, 2026-11-22). Feature
branches are never merged into local `dev`; the primary checkout only
fast-forwards to `origin/dev`. Parallel sessions see each other's work because
every new worktree starts from `origin/dev`, and the Claude Code session brief
lists every other worktree and any local-only commit
([docs/harness/README.md](../harness/README.md)). The former local-first +
evening-batch model (`local-dev-batch-ci.md`) is retired.

Respect the active agent's authorization and confirmation policies. Never bypass
branch protection, required reviews, required checks, or repository permissions.

**Merge yetkisi (2026-08-15, alpkaan).** Teslimat PR'ları için merge onayı
KALICI olarak verilmiştir: kapılar yeşil ve PR mergeable ise, her PR için ayrıca
"merge edeyim mi?" diye sorma — merge et ve kapanışa (dal temizliği,
`bun run project:sync`, tracker doğrulaması) devam et. Bu yalnız **onay adımını**
kaldırır, hiçbir kapıyı gevşetmez: kırmızı check'e rağmen merge, admin bypass ve
`§7`'deki koşulların atlanması hâlâ yasak. Olağan teslimat dışındaki işler
(deploy, geri alınamaz/dışa dönük işlemler) ayrı onay ister. Merge sonrası ne
yapıldığı raporlanır.

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

Use a sibling directory `../bakimx-<number>` (keeps the worktree's sources out
of the primary checkout's tsc/eslint/Turbopack scope):

```sh
git fetch origin dev
git worktree add -b issue/123-short-slug ../bakimx-123 origin/dev
bun run worktree:env -- ../bakimx-123
cd ../bakimx-123 && bun install   # real node_modules; Turbopack rejects a symlink
```

The environment setup command links the primary checkout's ignored `.env.local`
into the new worktree. Run it immediately after creating every issue worktree so
`bun run dev` and `bun run dev:tunnel` use the configured development database.
It refuses to overwrite an existing environment file and never copies secrets
into Git history. If the primary checkout has no `.env.local`, stop and ask the
user to configure it; do not rely on the build-safe placeholder database URL.

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

## 5. Optional preview before merge

The user normally checks the result on localhost:3001 after the merge (§9). When
a preview before merge is useful (a visible product decision, or the user asks),
serve the worktree on its own port — never switch or merge into the primary
checkout:

```sh
cd ../bakimx-123
bunx next dev --port 3223   # 3200 + (issue number mod 100)
```

- `.env.local` is a symlink to the primary's file (AWS dev DB through the SSM
  tunnel on 5433). A branch with a migration needs an isolated database passed as
  `DATABASE_URL`/`DIRECT_URL` environment overrides — never edit `.env.local`
  and never `migrate deploy` the branch into the shared dev DB.
- Log in with `/api/auth/dev-login?email=admin@bakimx.com&redirect=<path>`.
- Stop the server when done.

## 6. Commit and pull request

- Keep commits intentional and limited to issue-owned files.
- Use a descriptive commit such as `fix(#123): correct intake validation`.
- Rebase or merge the latest `origin/dev` before the final validation when the
  branch has drifted; never force-push shared work without explicit authorization.
- Push the issue branch and open a PR targeting `dev`. No label is needed —
  `quality` runs on every PR into `dev` and `main`.
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
- Open as draft only while implementation work remains; a delivery that is
  ready for CI and merge is opened ready for review.

## 7. Checks, review, and merge

- If the user only asked for commit/PR, **stop after §6** — do not merge.
- Monitor `quality` to a terminal state (`gh pr checks <n> --watch --fail-fast`,
  unpiped). Inspect logs and fix failures attributable to the branch; rerun
  proportionate local validation after fixes.
- Before CI/merge, merge the latest `origin/dev` into the branch so the gate runs
  on a current base (repo-guardrails §2.1).
- Resolve actionable review comments and re-check the diff.
- Merge only when the PR is non-draft, mergeable, approved as required, current
  with `dev`, and `quality` is green.
- Bu koşullar sağlandığında merge için ayrıca insan onayı BEKLENMEZ — bkz.
  yukarıdaki "Merge yetkisi" notu.
- Squash-merge feature PRs into `dev` and pass an explicit `--body`: the
  repository default pastes every commit message into the squash body. Release
  PRs (`dev → main`) use a merge commit and never delete `dev`. Never use admin
  bypass.
- **Squash mesajını yazarken `[deploy-dev]` gerekip gerekmediğine karar ver.** PR
  yeni bir Prisma migration ekliyorsa işaretçi ZORUNLUDUR — dev veritabanı
  `migrate deploy`'u yalnız o deploy'un içinde alır, unutulursa app-dev'in şeması
  koddan geri kalır. Diğer durumlar ve gerekçesi:
  [repo-guardrails.md](./repo-guardrails.md) §6. 18-08'de BAK-98'in migration'ı
  bu yüzden dev'e uygulanmadı.
- A deployment workflow triggered after merge is distinct from PR validation.
  Report its status; do not claim deployment success before it completes.

## 8. Closure and project automation

- Confirm the merged PR contains the closing keyword. The default branch is
  `main`, so a merge into `dev` does **not** close the GitHub issue: close it
  right after the merge with `gh issue close <n> --comment "dev'e merge edildi:
  #<pr>"`.
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

## 9. Cleanup and local synchronization

- Fast-forward the primary checkout so localhost:3001 shows the merged result:

```sh
git -C ~/www/bakimx fetch origin
git -C ~/www/bakimx merge --ff-only origin/dev
```

  If `bun.lock` changed, run `bun install` there and `touch next.config.ts` (the
  dev server restarts itself); if `prisma/schema.prisma` changed, the post-merge
  hook regenerates the client and the dev server needs a restart.
- If the fast-forward fails — local `dev` has commits that never went up as PRs,
  or an uncommitted file blocks it — leave the primary untouched and report the
  exact blocker. Never `reset --hard`, stash or merge to force it; realigning a
  diverged local `dev` needs the user's OK.
- Delete only this delivery's resources: the remote issue branch, the worktree
  (`git worktree remove ../bakimx-<number>`) and its local branch. Verify targets
  exactly before each operation.
- Never use broad cleanup commands such as `git worktree prune`, wildcard branch
  deletion, or `git clean` as routine cleanup.

## Final report

Report the issue, branch, PR, merge commit, checks run, Actions/deployment state,
issue/project state, cleanup performed, and whether the primary checkout was
fast-forwarded (localhost:3001 shows the change). List any skipped or failing
verification explicitly.

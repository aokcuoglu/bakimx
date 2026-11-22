---
name: design-check
description: Audit BakımX UI against DESIGN.md (e-santral pattern), docs/ui-control-sizing.md and the AGENTS.md UI rules — deterministic source gates first (bun run harness:gates), then a bakimx-ui-ux review of the diff (screenshots if a server is given). Use for "/design-check", "/design-check <path>", or before opening a PR that touches .tsx/.css files.
argument-hint: [--changed | path…] [routes…]
---

Arguments: `$ARGUMENTS` (default: the current branch's changes).

1. In the worktree (primary checkout only for a repo-wide audit — read-only) run `bun run harness:gates`; paste failures verbatim. They block the PR (CI runs them as part of `bun test`).
2. Call `bakimx-ui-ux` with the worktree path, the files/paths in scope and the given routes. Ask for screenshots only if a worktree server is running (e.g. the 32NN port `/qa` opened); 3001 serves the primary checkout, not the worktree.
3. Merge into one list: 🔴 → 🟡 → 🟢, with file:line and fix. For a repo-wide audit group by component/page and propose Issues via `/issue` instead of fixing in place. Report to the user in Turkish.

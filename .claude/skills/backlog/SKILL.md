---
name: backlog
description: Triage and burn down the BakımX GitHub backlog — runs the bakimx-triage agent over all open issues, applies the safe, evidenced bookkeeping (tick checklists, close verifiably-done issues, link duplicates), syncs the project board, and reports a priority order plus the next conflict-free parallel wave for /ship. Use for "/backlog", "ne kaldı?", "issue'ları temizle", or after a batch of merges.
---

1. `git -C /Users/void/www/bakimx fetch origin` (do not change the primary checkout; the agent reads `origin/dev`).
2. Call `bakimx-triage` (no extra arguments). Wait for its table.
3. Apply only reversible, evidenced edits:
   - Tick checklist items that have a merged PR (`gh issue view N --json body -q .body` → edit → `gh issue edit N --body-file …`; keep the rest of the body).
   - Close **done** ones with a comment citing the evidence: `gh issue close N --comment "Tamamlandı: #PR — <kanıt>"`.
   - **duplicate**: comment "Duplicate of #M", close the newer one.
   - **obsolete** and **operations**: never auto-close — list them to the user with the reason.
   - **partial**: write the remainder as a comment; if the remainder is a different scope, open a new Issue under `/issue` rules and link it.
4. `bun run project:sync` so closed issues show Done on `Factory - BakimX`.
5. Report to the user in Turkish: open count (before → after), what closed and why, priority order and the next parallel wave. Suggest starting the wave with `/ship` (worktrees in parallel, browser QA one at a time).

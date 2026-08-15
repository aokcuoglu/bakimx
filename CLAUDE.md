# BakimX Project Rules

@AGENTS.md
@docs/agent-workflows/issue-delivery.md
@docs/agent-workflows/repo-guardrails.md

BakimX is a Next.js auto repair workshop SaaS project.

## Product context
- Target users: auto repair workshops, mostly mobile-first usage.
- Brand direction: blue/navy professional automotive SaaS style.
- Self-serve signup is an approval-gated trial application: `/register` creates a workshop in `pending` status with no access until an admin approves (no instant public provisioning). There is no instant public register flow.
- Forgot password should guide users to company contact/support.
- Current MVP focus: intake, customer, vehicle, work order, photo checklist, damage marking, public service summary, PDF/WhatsApp output.

## Coding rules
- Always inspect existing patterns before editing.
- Do not introduce large rewrites unless explicitly requested.
- Prefer small, safe, reviewable commits.
- Keep TypeScript strict and avoid `any` unless justified.
- Do not change database schema without explaining migration impact. Schema, migration, and the code that uses them ship in the same PR.
- Do not touch `.env`, secrets, production credentials, or deployment config unless explicitly requested.
- The app itself never runs in Docker locally — `bun run dev` on the host. Local Postgres/MinIO do run in Docker via `docker-compose.local.yml`; that is the intended setup, not a violation. Docker images are for production (built in CI, run on AWS ECS).
- Prefer server components where appropriate.
- Validate user input on server-side routes/actions.
- Keep tenant/workshop isolation in every data query.
- Keep mobile UX first.

## Before editing
- First summarize the current relevant files.
- Then propose a short implementation plan.
- Wait for approval before broad refactors.

## Issue delivery
- When a user asks to implement or deliver a GitHub issue by number, use the
  `bakimx-issue-delivery` project skill and follow
  `docs/agent-workflows/issue-delivery.md` end to end unless the user narrows the
  scope. That document is the single source for branching, PR closing keywords,
  merge, and cleanup — do not restate its rules elsewhere.
- Never disturb unrelated local changes.

## After editing
Run the CI gate locally, in this order: `bun test`, `bun run lint`,
`bun run typecheck`, `bun run build`. Lint must be at zero errors.
Recurring traps this repo has already paid for — stale-branch merges, missing
migrations, source-scanning regression tests, test file naming — are listed with
their sources in `docs/agent-workflows/repo-guardrails.md`. Read it before
opening a PR.

## Expected answer style
- Explain what changed.
- Mention risk areas.
- Mention files touched.
- Mention manual QA steps.

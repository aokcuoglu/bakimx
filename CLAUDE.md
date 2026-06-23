# BakimX Project Rules

BakimX is a Next.js auto repair workshop SaaS project.

## Product context
- Target users: auto repair workshops, mostly mobile-first usage.
- Brand direction: blue/navy professional automotive SaaS style.
- Local development must avoid Docker on MacBook.
- Docker is only for VPS/production later.
- Login has no public register flow.
- Forgot password should guide users to company contact/support.
- Current MVP focus: intake, customer, vehicle, work order, photo checklist, damage marking, public service summary, PDF/WhatsApp output.

## Coding rules
- Always inspect existing patterns before editing.
- Do not introduce large rewrites unless explicitly requested.
- Prefer small, safe, reviewable commits.
- Keep TypeScript strict and avoid `any` unless justified.
- Do not change database schema without explaining migration impact.
- Do not touch `.env`, secrets, production credentials, or deployment config unless explicitly requested.
- Do not add Docker for local development.
- Prefer server components where appropriate.
- Validate user input on server-side routes/actions.
- Keep tenant/workshop isolation in every data query.
- Keep mobile UX first.

## Before editing
- First summarize the current relevant files.
- Then propose a short implementation plan.
- Wait for approval before broad refactors.

## After editing
Run or suggest the relevant checks:
- package manager install check
- lint
- typecheck
- tests if available
- build if the change is significant

## Expected answer style
- Explain what changed.
- Mention risk areas.
- Mention files touched.
- Mention manual QA steps.
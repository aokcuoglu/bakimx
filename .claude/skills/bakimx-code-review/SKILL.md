---
name: bakimx-code-review
description: Review BakımX code changes for Next.js, TypeScript, tenant isolation, auth, security, mobile UX, and maintainability. Use when reviewing diffs, preparing commits, or checking implementation quality.
allowed-tools: Read Grep Glob Bash
---

# BakımX Code Review

Review the current changes as a senior Next.js SaaS engineer.

## Project context
BakımX is a mobile-first auto repair workshop SaaS.
The app runs on the host (`bun run dev`); only local Postgres/MinIO run in Docker
via `docker-compose.local.yml`. Production images are built in CI and run on AWS
ECS. Brand direction is blue/navy professional automotive SaaS.

Read `AGENTS.md` and `docs/agent-workflows/repo-guardrails.md` before reviewing —
the guardrails file lists the mistakes this repo has already made twice.

## Check these areas
1. TypeScript safety
2. Next.js 16 App Router correctness — dynamic `params`/`searchParams` awaited
3. Server/client component boundaries
4. Auth/session assumptions
5. Tenant/workshop isolation
6. Server-side validation
7. Prisma query safety; schema + migration present when new models are used
8. Mobile-first UX impact
9. Error, empty, and loading states
10. Unnecessary refactors
11. Accidental .env/secret changes
12. Local setup violations (an application Docker image for local dev)
13. UI contract: shadcn primitives over raw HTML controls, theme tokens over
    hardcoded colors — `src/lib/ui-contract.test.ts` and
    `src/lib/theme-tokens.test.ts` fail the build on violations

## Output format
- Critical issues
- Medium issues
- Nice-to-have improvements
- Files that need another look
- Manual QA checklist
- Safe to commit: Yes/No

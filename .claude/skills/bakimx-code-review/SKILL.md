---
name: bakimx-code-review
description: Review BakımX code changes for Next.js, TypeScript, tenant isolation, auth, security, mobile UX, and maintainability. Use when reviewing diffs, preparing commits, or checking implementation quality.
allowed-tools: Read Grep Glob Bash
---

# BakımX Code Review

Review the current changes as a senior Next.js SaaS engineer.

## Project context
BakımX is a mobile-first auto repair workshop SaaS.
Local development must avoid Docker.
Docker is only for VPS/production later.
Brand direction is blue/navy professional automotive SaaS.

## Check these areas
1. TypeScript safety
2. Next.js App Router correctness
3. Server/client component boundaries
4. Auth/session assumptions
5. Tenant/workshop isolation
6. Server-side validation
7. Supabase/Prisma query safety
8. Mobile-first UX impact
9. Error, empty, and loading states
10. Unnecessary refactors
11. Accidental .env/secret changes
12. Docker/local setup violations

## Output format
- Critical issues
- Medium issues
- Nice-to-have improvements
- Files that need another look
- Manual QA checklist
- Safe to commit: Yes/No

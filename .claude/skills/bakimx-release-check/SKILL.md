---
name: bakimx-release-check
description: Check whether BakımX changes are ready for commit or release by reviewing build, lint, typecheck, migrations, env risks, local Docker restrictions, and manual QA.
allowed-tools: Read Grep Glob Bash
---

# BakımX Release Check

Assess release readiness for the current changes.

## Must check
1. Git diff summary
2. Files touched
3. Package/dependency changes
4. Database schema or migration changes — code using a new Prisma model without
   its migration breaks the build on `dev` (PR #339 was reverted by PR #343)
5. Environment variable changes
6. Auth/session impact
7. Tenant/workshop isolation impact
8. Local Docker violation risk (an app image for local dev; `docker-compose.local.yml`
   for Postgres/MinIO is expected)
9. Branch freshness — is `origin/dev` merged in and the gate re-run on the result?
10. Test/lint/typecheck/build results
11. Manual QA steps

## Recommended commands
The package manager is bun. Run the same gate CI runs
(`.github/workflows/quality.yml`), in this order:

```sh
bun test
bun run lint          # zero errors required
bun run typecheck
bun run build         # needs SESSION_SECRET
bun run db:validate   # when prisma/schema.prisma changed
```

Do not run destructive commands.
Do not add an application Docker image for local development.
Do not modify .env files.

## Output
- Release readiness: Ready / Not ready
- Blockers
- Non-blocking risks
- Commands run or recommended
- Manual QA checklist
- Suggested commit message

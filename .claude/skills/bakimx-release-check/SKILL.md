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
4. Database schema or migration changes
5. Environment variable changes
6. Auth/session impact
7. Tenant/workshop isolation impact
8. Local Docker violation risk
9. Build/lint/typecheck commands
10. Manual QA steps

## Recommended commands
Use the package manager already used by the project.

Common checks:
- npm run lint
- npm run typecheck
- npm run build

Do not run destructive commands.
Do not run Docker for local BakımX development.
Do not modify .env files.

## Output
- Release readiness: Ready / Not ready
- Blockers
- Non-blocking risks
- Commands run or recommended
- Manual QA checklist
- Suggested commit message

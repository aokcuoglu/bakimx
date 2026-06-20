<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# BakimX — Project Commands

## Development
- **Install:** `bun install` (or `npm install`)
- **Dev server:** `bun run dev` (or `npm run dev`)
- **Build:** `bun run build` (or `npm run build`)
- **Lint:** `bun run lint` (or `npm run lint`)
- **Typecheck:** `bun run typecheck` (or `npm run typecheck`)
- **DB push:** `bun run db:push` — apply Prisma schema to database
- **DB seed:** `bun run db:seed` — seed demo data (demo@bakimx.com / demo123456)
- **DB studio:** `bun run db:studio` — Prisma Studio on port 5555
- **DB migrate:** `bun run db:migrate` — create migration (use `prisma migrate deploy` for production)

## Local Infrastructure
- **Start services:** `docker compose -f docker-compose.local.yml up -d`
- **Stop services:** `docker compose -f docker-compose.local.yml down`
- **Reset DB + Storage:** `docker compose -f docker-compose.local.yml down -v && docker compose -f docker-compose.local.yml up -d`
- **MinIO Console:** http://localhost:9001 (bakimx / bakimx-dev-secret)
- **PostgreSQL:** localhost:5432 (bakimx / bakimx)

## Tech Stack
- Next.js 16 App Router + TypeScript + Tailwind CSS v4 + shadcn/ui (base-nova style)
- Uses `@base-ui/react` (NOT Radix) for shadcn/ui primitives
- Button uses `render` prop (NOT `asChild`) for link rendering
- Accordion uses Base UI API (no `type`/`collapsible` props)
- Select `onValueChange` receives `(value: string | null)`
- Prisma ORM with PostgreSQL
- Storage: mock (default) / S3-compatible (MinIO local / Cloudflare R2 production)

## Architecture
- **Application** runs on host via `bun run dev` — NOT in a Docker container
- **Dev infrastructure** (PostgreSQL, MinIO) runs in OrbStack/Docker via `docker-compose.local.yml`
- Production uses `Dockerfile` + `docker-compose.yml` (app container + DB)
- No application Docker image for local dev

## Important
- Package manager: bun (with npm compatibility)
- STORAGE_PROVIDER=s3 requires MinIO (local) or R2 (production) — S3 provider code is fully implemented
- All providers (OCR, AI, SMS, WhatsApp, Email, Calendar) default to mock — no API keys needed for dev
- Demo login: demo@bakimx.com / demo123456
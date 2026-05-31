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

## Tech Stack
- Next.js 16 App Router + TypeScript + Tailwind CSS v4 + shadcn/ui (base-nova style)
- Uses `@base-ui/react` (NOT Radix) for shadcn/ui primitives
- Button uses `render` prop (NOT `asChild`) for link rendering
- Accordion uses Base UI API (no `type`/`collapsible` props)
- Select `onValueChange` receives `(value: string | null)`

## Important
- NO Docker files in this project
- NO database requirement yet
- NO Prisma yet
- Package manager: bun (with npm compatibility)
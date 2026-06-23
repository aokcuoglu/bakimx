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
- **DB push:** `bun run db:push` — apply schema directly (LOCAL prototyping only; NEVER prod — use `bun run db:deploy` / `prisma migrate deploy`)
- **DB seed:** `bun run db:seed` — seed demo data (demo@bakimx.com / demo123456)
- **DB studio:** `bun run db:studio` — Prisma Studio on port 5555
- **DB migrate:** `bun run db:migrate` — create migration (use `prisma migrate deploy` for production)

## Local Infrastructure
- **Start services:** `docker compose -f docker-compose.local.yml up -d`
- **Stop services:** `docker compose -f docker-compose.local.yml down`
- **Reset DB + Storage (LOCAL ONLY, destructive):** `./scripts/local-reset.sh` — guarded wrapper; never run `docker compose down -v` directly (the same muscle memory wipes prod's `pgdata`)
- **MinIO Console:** http://localhost:9001 (bakimx / bakimx-dev-secret)
- **PostgreSQL:** localhost:5432 (bakimx / bakimx)

## Tech Stack
- Next.js 16 App Router + TypeScript + Tailwind CSS v4 + shadcn/ui (base-nova style)
- Uses `@base-ui/react` (NOT Radix) for shadcn/ui primitives
- Button uses `render` prop (NOT `asChild`) for link rendering
- Accordion uses Base UI API (no `type`/`collapsible` props)
- Select `onValueChange` receives `(value: string | null)`
- Form: react-hook-form + zod + shadcn Form component (uses @radix-ui/react-slot transitively)
- Toast: sonner (<Toaster /> in root layout)
- Prisma ORM with PostgreSQL
- Storage: mock (default) / S3-compatible (MinIO local / Cloudflare R2 production)

## UI Component Rules
- **NO raw HTML interactive elements** — always use shadcn/ui components:
  - `<button>` → `<Button>`
  - `<input>` → `<Input>`
  - `<select>` → `<Select>`
  - `<textarea>` → `<Textarea>`
  - `<input type="checkbox">` → `<Checkbox>`
  - `<input type="radio">` → `<RadioGroup>`
  - `<nav>` with tab logic → `<Tabs>`
  - `fixed inset-0` modals → `<Dialog>` or `<Sheet>`
  - toggle button groups → `<ToggleGroup>` + `<ToggleGroupItem>`
  - on/off switches → `<Switch>` (NOT checkbox for toggle)
- **`<Link>` as button:** use `<Button nativeButton={false} render={<Link href={...} />}>` (NOT `<Link><Button>...</Button></Link>`)
- **Variants over custom CSS:** use `variant`, `size`, `color` props instead of custom className strings
- **No hardcoded colors:** use theme tokens (`primary`, `destructive`, `muted`, `border`, `ring`) — avoid `blue-600`, `rose-50`, `green-50` etc.
- **Toast:** ephemeral success/error → `toast.success()` / `toast.error()` (sonner). Persistent alerts → `<Alert>` component
- **Tooltip:** wrap with `<TooltipProvider>` (in root layout), use `<Tooltip>` for hover hints (not native `title=` attribute)

## Form Rules
- **All forms use react-hook-form + zod + shadcn Form component** (NOT useState)
- Zod schemas live in `src/lib/validations/<entity>.ts`
- Pattern: `useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues })`
- Fields: `<FormField control={form.control} name="..." render={({ field }) => (<FormItem><FormLabel>...</FormLabel><FormControl>...</FormControl><FormMessage /></FormItem>)} />`
- Server actions kept — `onSubmit` builds `FormData` from form values and calls the action
- Server errors shown via `<Alert variant="destructive">`
- Dynamic arrays (line items): use `useFieldArray` from react-hook-form
- Multi-step wizards: single `useForm` for all steps, `form.trigger(["field1"])` to validate per step

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
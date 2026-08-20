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
- **Dev login (QA):** `GET /api/auth/dev-login?email=<seed-user>&redirect=<path>` — opens a session without typing a password (default `admin@bakimx.com`, redirect `/dashboard`). Only responds when `NODE_ENV=development` AND the request host is localhost; 404 everywhere else. Use it for browser QA in isolated worktrees instead of hand-rolling a temporary login route.
- **Test:** `bun test` (unit) / `bun run test:e2e` (Playwright). Unit tests are `*.test.ts`, end-to-end tests **must** end in `*.e2e.ts` — the two runners share the `*.spec.ts` pattern and `bun test` dies on a Playwright file (`playwright.config.ts:7-10`, PR #306).
- **Git hooks:** `postinstall` registers `core.hooksPath=.githooks`. `post-merge`/`post-checkout` re-run `prisma generate` whenever `prisma/schema.prisma` changed in the pulled/checked-out range — otherwise the generated client stays stale and Prisma throws `Unknown argument` for fields that DO exist in the schema. Restart the dev server after it fires (Turbopack does not hot-reload `node_modules`).

## Local Infrastructure
- **Start services:** `docker compose -f docker-compose.local.yml up -d`
- **Stop services:** `docker compose -f docker-compose.local.yml down`
- **Reset DB + Storage (LOCAL ONLY, destructive):** `./scripts/local-reset.sh` — guarded wrapper; never run `docker compose down -v` directly (the same muscle memory wipes prod's `pgdata`)
- **MinIO Console:** http://localhost:9001 (bakimx / bakimx-dev-secret)
- **PostgreSQL:** localhost:5432 (bakimx / bakimx)

## Tech Stack
- Next.js 16 App Router + TypeScript + Tailwind CSS v4 + shadcn/ui (radix-nova style)
- **Dynamic route `params` and `searchParams` are Promises** — type them as `Promise<...>` and `await` them. Reading `params.code` directly yields `undefined` and throws at runtime while typecheck and lint stay green; that shipped the `/w/[code]` login page broken to production (PR #336, fixed pattern in `src/app/w/[code]/page.tsx:9-17`)
- **Primitive hattı Radix'tir; geçiş KAPANDI** (`components.json` → `"style":
  "radix-nova"`, BAK-152…BAK-156). Radix'e taşınanlar (`radix-ui` paketi,
  `asChild`): çekirdek (Button, Badge, Label, Separator — BAK-152), overlay
  (Dialog, AlertDialog, Sheet, Popover, Tooltip, DropdownMenu — BAK-153), form
  (Select, Checkbox, Switch, Toggle, ToggleGroup, Tabs, Accordion, Form,
  InputGroup — BAK-154), Item ailesi (BAK-155).
  `@base-ui/react` **bilinçli olarak** üç yüzeyde kalır — Radix'te dengi yok:
  `ui/combobox.tsx`, `ui/autocomplete.tsx` ve `ui/sidebar.tsx` içindeki
  `useRender`/`mergeProps`. Paket bu yüzden `package.json`'da durur; bu beklenen
  durumdur, sökülecek bir artık değil. Bir bileşeni düzenlemeden önce import
  satırına bak.
- Radix hattındaki bileşenlerde kompozisyon `asChild` ile yapılır — `render` ve
  `nativeButton` **yok** (`src/lib/ui-contract.test.ts` geri gelmesini engeller)
- Accordion Radix API'sini kullanır: `type="single" collapsible` ya da `type="multiple"`
  **zorunlu**, `AccordionItem` `value` **zorunlu**
- Select `onValueChange` `(value: string)` alır. `<SelectItem value="">` Radix'te yasak;
  `select.tsx` boş dizeyi bileşen sınırında nöbetçi bir değere çevirip geri döndürür,
  yani çağrı yerlerinde "boş dize = seçim yok" sözleşmesi aynen geçerli. Boş seçimde
  tetikleyicide metin görünmesi gerekiyorsa `<SelectValue placeholder="…" />` ver.
- ToggleGroup `type="single"` grubunda öğeler `role="radio"` alır ve `aria-pressed`
  **basılmaz** — seçili görünümü `data-[state=on]:` ile ver, `aria-pressed:` ile değil
- Form: react-hook-form + zod + shadcn Form component (`Slot` `radix-ui` paketinden)
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
- **`<Link>` as button:** use `<Button asChild><Link href={...}>…</Link></Button>` — the link is the
  child and carries the children (NOT `<Link><Button>…</Button></Link>`)
- **Variants over custom CSS:** use `variant`, `size`, `color` props instead of custom className strings
- **No hardcoded colors:** use theme tokens (`primary`, `destructive`, `muted`, `border`, `ring`) — avoid `blue-600`, `rose-50`, `green-50` etc.
- **Semantic colors have three roles — pick the right token:**
  - fill / bar / dot / tinted bg → `bg-success`, `bg-warning/10`, `border-destructive/20` (vivid tone; warning must stay amber)
  - text / icon on a filled surface → `text-success-foreground` (only on solid `bg-<color>`)
  - text / icon on a light surface (card, tinted box, plain bg) → **`text-success-strong`**, `text-warning-strong`, `text-destructive-strong`
  Bare `text-success` / `text-warning` / `text-destructive` fails WCAG AA on light
  surfaces (2.69–3.99:1) — `src/lib/theme-tokens.test.ts` fails the build on it,
  and also enforces 4.5:1 for every `<color>`/`<color>-foreground` pair.
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
- Production uses `Dockerfile` (image built in CI, run on AWS ECS Fargate; DB is RDS)
- No application Docker image for local dev

## Important
- Package manager: bun (with npm compatibility)
- STORAGE_PROVIDER=s3 requires MinIO (local) or R2 (production) — S3 provider code is fully implemented
- All providers (OCR, AI, SMS, WhatsApp, Email, Calendar) default to mock — no API keys needed for dev
- Demo login: demo@bakimx.com / demo123456

## GitHub Issue Delivery
- When the user asks to implement a GitHub issue by number, follow `docs/agent-workflows/issue-delivery.md` end to end — that document owns the full lifecycle (intake, isolated `issue/<number>-<slug>` worktree off the latest `origin/dev`, validation, PR, merge, project verification, cleanup). Do not restate it here.
- Never stash, reset, overwrite, commit, or clean unrelated user changes.
- **Two closing lines, one per tracker:** `Closes #<number>` for GitHub, plus `Closes <MULTICA-KEY>` (e.g. `Closes BAK-7`) when Multica tracks the same work. Neither implies the other; a bare key mention without a closing keyword is filed as `reference_only` and never becomes a visible link. Never invent a key.
- **Link at PR-open time only.** Never link a PR from a closed issue's Development panel — project automation reacts to the link and overwrites `Done`.
- Finish delivery with `bun run project:sync` — idempotent, board-only, safe to re-run.
- Before pushing, merge the latest `origin/dev` into your branch and re-run the gate: a PR's green check only covers its head commit, and nothing forces a **dev-targeted** branch to be up to date (`main` does require it since BAK-89, `dev` does not). See `docs/agent-workflows/repo-guardrails.md`.

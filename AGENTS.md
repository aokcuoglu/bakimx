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
  `@base-ui/react` **bilinçli olarak** İKİ yüzeyde kalır — Radix'te dengi yok
  (`radix-ui@1.6.7` içinde combobox/autocomplete girdisi yoktur, upstream
  shadcn da bunları Base UI üstünde verir): `ui/combobox.tsx` ve
  `ui/autocomplete.tsx`. Paket bu yüzden `package.json`'da durur; bu beklenen
  durumdur, sökülecek bir artık değil. `ui/sidebar.tsx` BAK-189'da Radix
  `Slot`'a geçti — artık `render` değil `asChild` alır. Bir bileşeni
  düzenlemeden önce import satırına bak.
- **Combobox/Autocomplete'te Escape'i call-site'ta ELLE korumaya çalışma.**
  Base UI Escape'te yalnız listeyi kapatmıyor: Combobox'ta commit edilmiş seçimi,
  Autocomplete'te (liste kapalıyken) serbest metni de siliyor. Ayrıca Radix
  `DismissableLayer` Escape'i document/capture'da dinlediği için diyalog içindeki
  bir Base UI popup'ında tek Escape hem popup'ı hem diyaloğu kapatıyordu. İkisinin
  de guard'ı artık paylaşılan bileşenlerde — `ui/combobox.tsx`
  (`keepSelectionOnEscape`), `ui/autocomplete.tsx` ve `ui/base-ui-popup.ts`
  (`yieldEscapeToBaseUIPopup`, `Dialog`/`Sheet`/`AlertDialog` içinde). Call-site'a
  `preventBaseUIHandler()` kopyalaman gerekmez; `src/lib/ui-contract.test.ts` geri
  sızmasını da engeller (BAK-190).
- **`data-open:` / `data-closed:` / `data-checked:` / `data-unchecked:` /
  `data-active:` / `data-horizontal:` / `data-vertical:` Base UI kalıntısı
  DEĞİLDİR ve Radix bileşenlerinde ÇALIŞIR.** `globals.css`in içeri aldığı
  `shadcn/tailwind.css` bunları `@custom-variant` olarak tanımlar ve her biri
  İKİ seçici üretir — Radix'in `data-state="…"` / `data-orientation="…"`
  yazımı ve Base UI'ın varlık niteliği
  (`node_modules/shadcn/dist/tailwind.css:28-88`):

  ```css
  .data-checked\:bg-primary:where([data-state="checked"]),
  .data-checked\:bg-primary:where([data-checked]:not([data-checked="false"]))
  ```

  Yani kısayol iki kütüphaneyi köprüleyen bilinçli bir shim; `data-[state=…]`e
  çevirmek gereksiz bir fark üretir. (BAK-189'un ilk teslimatı, PR #463, bunları
  "ölü" sanıp çevirdi — tarayıcı ölçümü çeviri ÖNCESİ hâlin de çalıştığını
  gösterdi. Ayrıntı ve kanıt: `src/lib/ui-contract.test.ts`.) Kapı artık asıl
  riski, KÖPRÜNÜN KAYBOLMASINI bekçiler.
  **İstisna Tooltip:** Radix durumu `open` değil `instant-open` / `delayed-open`
  yazar, `data-open:` orada tutmaz — iki durum da açıkça yazılır. Radix'in
  `on`/`off` (Toggle) ve `indeterminate` (Checkbox) durumları için de kısayol
  yoktur; onlarda `data-[state=…]` şart.
- **Dikey `Tabs` / `ToggleGroup`'ta `orientation` prop'unu Root'a GEÇİR.**
  Sınıflar `data-orientation`a bakar ama Radix ok tuşu gezinmesini kendi
  `orientation` prop'undan okur; ikisi ayrışırsa görünüm dikey, klavye yatay
  kalır (BAK-189).
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
- **Landing/public section'larında `framer-motion` KULLANMA** (BAK-165). Paket
  duruyor (auth formları, `photo-lightbox`, `purchase-wizard`) ama landing'den
  bilinçli olarak söküldü: `motion` bileşenleri `initial` değerini sunucu
  HTML'ine satır içi `opacity:0` olarak basıyordu ve `/` yanıtındaki 70 gizli
  elemandan biri **LCP adayı `<h1>`**di — en büyük içerik ögesinin boyanması
  hidrasyona bağlıydı. Karşılıkları: girişte `.enter-up` / `.enter-pop` (saf
  CSS), kaydırmayla belirişte `components/shared/reveal.tsx`. Ölçüm, gerekçe ve
  ölçüm script'i: [docs/landing-performance.md](./docs/landing-performance.md).
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
  and also enforces 4.5:1 for every `<color>`/`<color>-foreground` pair, brand
  colors (`navy`, `whatsapp`) included.
- **`primary` has a `-strong` tone too, but the rule is narrower** (BAK-160): bare
  `text-primary` is fine as a link colour on a plain card (5.20:1). It only fails on
  a **tinted** background — `bg-primary/10 text-primary` measures 4.51:1 on a card,
  4.27:1 on the page background and 4.05:1 on `bg-muted`. So: `bg-primary/10` and
  `text-primary` on the same element → use **`text-primary-strong`**. The test scans
  exactly that pairing; it does not touch `text-primary` elsewhere.
- **`muted-foreground` has a `-strong` tone for the same reason** (BAK-189).
  Secondary text is fine on flat surfaces (card 6.00:1) — it drops on a **tinted**
  one, because the content area is `bg-muted`, not `bg-background`: a
  `bg-destructive/10` KPI card measured **4.43:1** in the browser. Tinted card →
  **`text-muted-foreground-strong`**. Put the tint class and the text class in the
  **same string literal** (see `bucketColors` in `cashbox/aging/page.tsx`); the gate
  in `theme-tokens.test.ts` only sees the pairing when they sit together, and a
  parent-tint / child-text split is invisible to it.
- **`opacity-*` on an element that styles text is a contrast bug** — the faded tone
  is inherited, so it cannot be measured statically. Remove it, or state the colour
  explicitly at the call site (`text-muted-foreground`, a `-strong` tone). Deliberate
  cases go into `OPACITY_UTILITY_EXCEPTIONS` **with a reason**. Same rule as the
  `text-<token>/<opacity>` gate; both live in `src/lib/theme-tokens.test.ts`.
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

# BakımX Engineering Squad

This repository is operated by a three-role engineering squad.

## Roles

### Atlas — Lead / Orchestrator
Owns:
- issue decomposition
- dependency graph
- scope reconciliation
- acceptance criteria
- review coordination
- release readiness
- production gates

Atlas should not implement ordinary feature code unless required to unblock review.

### Forge — Backend & Systems
Owns:
- APIs
- database
- Prisma
- integrations
- background jobs
- infrastructure-facing code
- reliability
- migrations
- backend tests

### Pixel — Product & Frontend
Owns:
- UI/UX
- React/client behavior
- accessibility
- frontend state
- user-facing validation
- browser-level acceptance
- frontend tests

## Source of truth

GitHub Issues are the shared work graph.

Every implementation task must be traceable to an issue.

Do not create duplicate issues when an existing issue already represents the work.

## Branch model

- `dev` = integration branch
- `main` = production branch
- feature work must use a dedicated branch/worktree
- production release scope must be reconciled explicitly before `main`

Never assume `dev -> main` is safe without checking exact commit scope.

## Work rules

1. Read the issue and current repository state before coding.
2. Identify dependencies and existing related work.
3. Keep changes narrowly scoped.
4. Do not silently expand product behavior.
5. Add tests for changed behavior.
6. Run the relevant repository quality gates.
7. Report exact commit/PR evidence.
8. Never claim production completion from a `dev` merge.

## Human gates

Stop and request human approval before:

- production/main release
- production migration execution
- destructive or irreversible data mutation
- production secret/config changes
- new commercial/pricing policy
- merchant/payment/invoice ownership changes
- security boundary expansion
- unrelated release-scope expansion

Do not stop for routine:
- implementation
- tests
- dev PR creation
- normal dev merge
- local validation
- dependency reconciliation

unless the issue explicitly requires review first.

## Production safety

Never:
- expose secret values
- paste tokens/credentials into issues
- edit production migration history manually
- bypass tenant/RBAC boundaries
- make test data look authoritative
- change timestamps merely to pass acceptance
- weaken fail-closed behavior to make a smoke test pass

## Handoff format

Every completed task should report:

- issue
- exact scope
- files changed
- behavior changed
- tests/gates
- PR/commit
- known risks
- remaining dependency
- recommended next owner

Do not return long narrative progress reports unless a blocker requires explanation.

## GetirBakım boundary

GetirBakım is the canonical catalog/commerce system of record.

BakımX consumes it through bounded partner contracts.

Do not:
- directly couple BakımX to GetirBakım DB
- expose supplier cost/margin
- infer fitment from OEM alone
- mutate BakımX inventory for external procurement unless explicitly designed

## Release environments

BakımX:
- DEV/PROD: AWS ECS

GetirBakım:
- production: Contabo VPS

Do not assume the repositories share deployment mechanics.

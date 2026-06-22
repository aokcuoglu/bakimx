# BakımX — Complete Git History Analysis

**Repo:** `aokcuoglu/bakimx` · **HEAD:** `a342e92` (merge of PR #4 → `v0.5.9`)
**Span:** 37 commits · 32 tags · v0.0.1 → v0.5.9 over 23 days (2026-05-31 → 2026-06-22)

> Note: tags are annotated/lightweight on the remote and weren't present locally until fetched.
> Releases `v0.3.2`, `v0.5.5`, `v0.5.6`, `v0.5.8`, `v0.5.9` ship **without** a `docs/releases/*.md`
> file — their intent was reconstructed from commit bodies. There is **no separate `v0.5.7.x` tag**
> (the follow-up patch is folded into `v0.5.7`).

---

## 1. Release Timeline Table (chronological)

| Tag | Date | Commit | Theme / Feature Introduced | Type |
|-----|------|--------|----------------------------|------|
| v0.0.1 | 05-31 | dbc8ccb | Premium landing page, brand identity, demo-request form + API | Foundation |
| v0.1.0 | 05-31 | 6494646 | **Vehicle Intake MVP**: auth, workshop profile, customers, vehicles, intake wizard, photo checklist, 2D SVG damage marking, mock SMS OTP, tokenized public output, basic service order, audit log | Feature |
| v0.1.1 | 06-01 | 0a3534a | MVP hardening: tenant isolation helpers, session/cookie hardening, mobile UX, storage abstraction prep | Hardening |
| v0.1.2 | 06-01 | 8a6f75f | Public output polish, PDF/print route, WhatsApp share-link gen, centralized totals util, data-safety stripping | Feature |
| v0.1.3 | 06-01 | 8c2c6fc | Intake **media storage foundation**: provider abstraction, file validation (MIME/8MB), tenant-scoped paths, signed URLs | Feature |
| v0.1.4 | 06-01 | fffb038 | **Work order UX** redesign + app shell; schema: `workOrderNo`, `paymentStatus`, technician, discount, tax; stub routes (Teklif/Randevu/Stok/Tedarikçi/Kasa/Rapor) | Feature |
| v0.1.5 | 06-02 | 88030e1 | **Customer management**: individual/corporate, tags, source, price group, KVKK consent, balances foundation | Feature |
| v0.2.0 | 06-02 | ca4980f | **Operations dashboard**: KPI cards, alerts, zero-dep CSS/SVG charts | Feature |
| v0.2.1 | 06-02 | 80b3803 | Vehicle management UX (list/detail/search) | Feature |
| v0.2.2 | 06-03 | 09a7688 | **Quotes & appointments** foundation | Feature |
| v0.2.3 | 06-03 | b92d9f1 | **Maintenance reminders** foundation (no real send) | Feature |
| v0.2.4 | 06-04 | 8be616c | **Parts & stock** foundation: catalog, thresholds, stock movements | Feature |
| v0.2.5 | 06-10 | 7735514 | **Supplier** foundation + part linkage | Feature |
| v0.3.0 | 06-11 | 99aa6e3 | **Cashbox & collections** foundation: manual/partial payments, cancellation, receivables | Feature |
| v0.3.1 | 06-12 | c80a7f6 | **OCR smart capture** foundation (ruhsat → customer/vehicle), provider abstraction | Feature |
| v0.3.2 | 06-12 | cf4051e | Evidence intake + customer trust portal improvements | Feature |
| v0.3.3 | 06-12 | e16cb4d | OCR hardening: real provider selection (deepseek/openai/tesseract), rawText privacy, dup warnings | Hardening |
| v0.3.4 | 06-12 | bc81c00 | **AI Service Advisor lite** (mock/openai/deepseek, confirm-only) | Feature |
| v0.3.5 | 06-13 | e49495f | **Digital vehicle service passport** + QR | Feature |
| v0.4.0 | 06-13 | 577e8f8 | **Technician mobile workspace**: parts requests, labor sessions, evidence | Feature |
| v0.4.1 | 06-13 | 97d02c7 | **Reporting overview** (orders/customers/collections/parts/technicians) | Feature |
| v0.4.2 | 06-14 | 1fc6040 | **Operational analytics** (rule-based, no LLM) | Feature |
| v0.5.0 | 06-14 | b2b96f9 | **Communications infra**: SMS/WhatsApp/Email provider abstraction (NetGSM, Resend, WhatsApp Business; mock default) | Feature |
| v0.5.1 | 06-14 | 46ec32c | **Calendar + reminder automation**: Google Calendar provider, scheduler, unified calendar | Feature |
| v0.5.2 | 06-14 | 4b3abdb | Billing/collections enhancement: aging report, cancellation reasons, export | Feature |
| v0.5.3 | 06-14 | c5ceeb4 | **Workshop settings** (7 tabs) + branding in portals/PDF, settings rate-limit & audit | Feature |
| v0.5.4 | 06-15 | 6095d82 | Operational UX speed: unified list patterns, KPI cards, action menus | Polish |
| v0.5.5 | 06-15 | bbdaf1a | **Supabase → self-hosted migration**: R2/S3 provider, Dockerfile, compose, GH Actions deploy, VPS provisioning | Infra |
| v0.5.6 | 06-20 | dc8e3f1 | Maintenance / version bump (no body) | Maint. |
| v0.5.7 | 06-21 | d859de6 | **P0 security**: register removed, login rate-limit/enum-defense/session-rotation, cron secret, status-transition guards, XSS escaping in PDF/HTML, WO-number uniqueness | Security |
| v0.5.8 | 06-21 | 10d2922 | **Tenant isolation hotfix**: 8 server actions now derive `workshopId` from session (not client) | Security |
| v0.5.9 | 06-22 | d9bc608 | **Migration baseline + money consistency**: squashed `0_init`, epsilon money helpers, `$transaction` wrapping, `@@unique([workshopId, workOrderNo])` | Hardening |

---

## 2. Completed Modules (production-ready or near)

- **Auth & session** — iron-session, bcrypt, rate-limited login, enumeration defense, session rotation, no public register
- **Tenant isolation** — session-derived `workshopId` enforced across all server actions/API routes (helpers: `requireAuth`, `assertWorkshopAccess`)
- **Vehicle intake** — wizard, guided photo checklist, 2D SVG damage marking, OTP customer approval (only path to `approved`)
- **Customer & vehicle records** — full CRUD, individual/corporate, KVKK consent, search
- **Work orders** — full lifecycle, items, payment status, technician assignment, discount/tax, durable unique WO numbers
- **Public output** — tokenized `/s/[token]` + PDF/print, XSS-escaped, internal-ID-stripped, visibility flags (`showPhotos`/`showOrderItems`/`showPaymentStatus`)
- **Cashbox & collections** — manual/partial payments, cancellation, aging, transactional recalc
- **Persistent media storage** — S3/Cloudflare-R2 (mock default), validated, tenant-scoped
- **Workshop settings** — 7-tab config + branding propagation
- **Operations dashboard & reporting & analytics** — real Prisma queries, zero-dep charts
- **Self-hosted deploy stack** — Docker (prod only), GH Actions GHCR + SSH, VPS provisioning, single migration baseline

## 3. Active / Partial Modules (foundation built, real integration not validated)

- **Communications (SMS/WhatsApp/Email)** — provider abstraction complete (NetGSM/Resend/WhatsApp Business), but **mock is default**; real-send path unproven in production
- **OCR smart capture** — ruhsat extraction works; real providers (DeepSeek/OpenAI/Tesseract) selectable but not the default; accuracy unvalidated
- **AI Service Advisor** — suggestion-only, confirm-mandatory; mock default
- **Calendar sync** — Google Calendar provider scaffolded, automation scheduler present; OAuth/real sync not productionized
- **Maintenance reminders** — records + channel preferences stored; **no guaranteed real dispatch**
- **Technician workspace** — functional but newer, least-hardened surface
- **Quotes/appointments → order conversion** — present, transactional as of v0.5.9

## 4. Features Superseded by Later Versions

- **Supabase storage** (v0.1.2/v0.1.3 placeholder + v0.1.3 impl) → **removed in v0.5.5**, replaced by S3/R2
- **Public registration** (`registerAction`, `/api/auth/register`, v0.1.0) → **removed/404 in v0.5.7** (per product rule: no public register)
- **Client-supplied `workshopId`** in server actions (pre-v0.5.8) → **superseded by session-derived auth in v0.5.8**
- **Timestamp-only WO numbers** (v0.1.4) → random suffix (v0.5.7) → **DB-unique constraint (v0.5.9)**
- **Per-location/duplicated totals math** → centralized `lib/totals.ts` (v0.1.2) → **epsilon-aware `lib/money.ts` (v0.5.9)**
- **Naive multi-write flows** → **`prisma.$transaction`-wrapped in v0.5.9**
- **Many scattered migrations** → **squashed into `0_init` baseline (v0.5.9)**

## 5. Current Architecture Maturity Level

**Level: Late-MVP / Pre-1.0 hardened beta (≈ "production-pilot ready").**

- ✅ Consistent **provider-abstraction pattern** across storage, OCR, AI, comms, calendar (clean, swappable, mock-default)
- ✅ **Security P0s closed** (v0.5.7–v0.5.8), **data integrity** addressed (v0.5.9 transactions + money)
- ✅ Self-hosted, containerized **deploy pipeline** with migration baselining
- ⚠️ **Thin automated test coverage** — only 3 unit files (`money.test.ts`, `totals.test.ts`, `cashbox/status.test.ts`); no integration/E2E
- ⚠️ **Single-instance assumptions** (in-memory rate-limit) block horizontal scaling
- ⚠️ Several "real" integrations remain **mock-default / unproven** in production

## 6. Technical Debt Still Open

| Debt | Source | Risk |
|------|--------|------|
| Money stored as `Float` (epsilon-mitigated, not `Decimal`) | v0.5.7 deferred / v0.5.9 note | Med — rounding drift at scale |
| In-memory rate-limiter (per-process, not shared/durable) | v0.5.7 deferred | High for multi-instance deploy |
| OTP entropy / expiry / attempt-limit hardening | v0.5.7 deferred, **still open** | Med — approval-flow abuse |
| `db.ts` placeholder DB connection fallback | v0.5.7 deferred, still in `src/lib/db.ts` | Low — masks misconfig |
| `middleware.ts` uses deprecated Next 16 convention (`proxy`) | v0.1.2 documented | Low — framework churn |
| Real comms/OCR/AI/calendar providers unvalidated in prod | foundations only | Med — feature reliability |
| Minimal automated test coverage | repo-wide | High — regression exposure |
| `Yakında` stubs: Excel import, voice fill | landing/features | Low — marketing promise gap |
| No e-fatura, no subscription/billing, no multi-branch | roadmap gaps | Product scope |

## 7. Security Hardening Completed

- **Tenant isolation** end-to-end (v0.1.1 helpers → v0.5.8 session-derived `workshopId` on all actions)
- **Public registration eliminated** (404 + redirect, v0.5.7)
- **Login**: IP rate-limit (8/60s, pre-DB), constant-time/enumeration-equalized responses, session rotation, hardened cookies (`httpOnly`/`secure`/`sameSite=lax`)
- **Cron** endpoint: required `CRON_SECRET`, constant-time `timingSafeEqual`
- **Status-transition guards**: enum whitelists; intake `approved` reachable **only** via OTP flow — customer approval cannot be bypassed
- **Stored-XSS closed** in `/s/[token]/pdf` & `/p/[token]/pdf` (full HTML escaping); React routes rely on JSX auto-escape
- **Public data minimization**: internal IDs/notes/internal timeline events/prices gated by visibility flags
- **Integrity**: `$transaction` on order/payment/OCR/approval flows; `@@unique([workshopId, workOrderNo])` (v0.5.9)
- **Auditing**: `AuditLog` + settings-change logging

## 8. Future Roadmap & Recommended Next 10 Versions (from HEAD = v0.5.9)

**Strategic theme: convert "foundations" into validated, scalable, billable production capability → 1.0.**

| Version | Title | Focus | Why now |
|---------|-------|-------|---------|
| **v0.6.0** | Distributed resilience | Redis/DB-backed rate-limit + OTP store (expiry, attempt-limit, entropy), remove `db.ts` placeholder | Unblocks multi-instance + closes top open security debt |
| **v0.6.1** | Comms go-live | Validate NetGSM SMS + WhatsApp Business + Resend in prod; delivery logs, retries, opt-out/KVKK enforcement | Activates the most-promised feature ("Yakında" SMS) |
| **v0.6.2** | Reminder automation live | Real scheduled dispatch of maintenance reminders over live comms; idempotent cron | Completes v0.2.3/v0.5.1 partials |
| **v0.6.3** | OCR/AI production validation | Real OCR accuracy benchmarking, fallback chain, cost guardrails; advisor prod-gating | De-risks AI cost/quality before charging |
| **v0.6.4** | Test & CI hardening | Vitest/Playwright E2E for intake→approval→order→payment; coverage gate in GH Actions | Highest leverage against regression risk |
| **v0.7.0** | Money correctness | Migrate money to `Decimal`/integer-minor-units; backfill migration; rounding audit | Retires the Float debt before billing |
| **v0.7.1** | Calendar sync GA | Google OAuth, two-way sync, conflict handling | Completes v0.5.1 foundation |
| **v0.7.2** | e-Fatura / e-Arşiv | Turkish e-invoice integration on top of cashbox | Major market requirement for TR workshops |
| **v0.8.0** | Subscription & billing | Plan tiers (matches landing pricing), entitlements, usage limits | Enables monetization / commercial launch |
| **v0.9.0 → v1.0.0** | Multi-branch + RBAC + observability | Branch isolation, role permissions, structured logging/metrics/Sentry, `middleware`→`proxy` migration, perf pass | Enterprise readiness → **1.0 GA** |

**Immediate next step recommendation:** ship **v0.6.0** (distributed rate-limit + OTP hardening) — it's the
single change that closes the highest-risk open security debt *and* unblocks the horizontal scaling that
every later version assumes.

---

*Generated from full git history analysis on 2026-06-22.*

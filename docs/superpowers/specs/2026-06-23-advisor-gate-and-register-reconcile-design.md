# Spec — Advisor Premium Gate + Register Doc Reconciliation

- **Date:** 2026-06-23
- **Status:** Approved (design)
- **Origin:** Two findings deferred from the `deploy-bakimx-production` review as "product decisions."

## Context

1. **AI advisor has no premium gate.** The entitlement is already declared
   (`src/lib/plan.ts`: `aiAdvisor` → `premium`) and marketed (`plans-catalog.ts`
   Premium package lists "AI servis danışmanı"), but **neither advisor API
   enforces it** — both `src/app/api/advisor/route.ts` and
   `src/app/api/orders/advisor/route.ts` only call `requireAuth()`. So any
   authenticated workshop on any tier can use it. This is an unenforced
   entitlement, not an undecided product question.

2. **A public `/register` flow exists**, conflicting with CLAUDE.md's
   "Login has no public register flow." Investigation showed it is actually an
   **admin-approval-gated trial application**: `/register` creates a Workshop in
   `approvalStatus: "pending"` + an owner User, does **not** auto-login, and shows
   "Başvurunuz alındı". The workshop cannot sign in until an admin approves. The
   landing page markets "15 Gün Ücretsiz Dene" CTAs to `/register`, and the whole
   approval/trial system (`WorkshopApprovalStatus`, `trialEndsAt`,
   `requestedPlanTier`) was built deliberately in v0.5.10. Meanwhile two code
   comments (`middleware.ts:8`, `login/actions.ts:14-15`) and the CLAUDE.md rule
   **falsely** claim registration was removed.

## Decisions (approved)

- **Register → Keep + reconcile docs.** Treat the approval-gated trial
  application as intended. No behavior change to the flow. Fix the stale
  CLAUDE.md rule and the two false comments to match reality.
- **Advisor → Enforce entitlement (mandatory) + Lock panel + upsell UI.**
- **Advisor stays Premium-only.** Trial workshops are on the `pro` tier, so they
  see the upsell, not the advisor. (Letting trials *sample* the advisor is an
  explicit out-of-scope future toggle.)

## Part A — Advisor entitlement enforcement + upsell UI

### A1. Backend gate (the real security fix; defense in depth)

In both `src/app/api/advisor/route.ts` and `src/app/api/orders/advisor/route.ts`:

- Replace `requireAuth()` with `getCurrentUserWithWorkshop()`.
- Before calling the AI provider, check
  `hasFeature(workshop.planTier as PlanTier, "aiAdvisor")`.
- If not entitled → return **HTTP 403** `{ error: "<premium msg>", code: "feature_locked" }`.
  403 (not 500) so the client can show upgrade messaging. Gating *before* the
  provider call means an unentitled caller incurs no model spend / no DB work.
- Existing `user.workshopId` / `user.id` usages are preserved.

### A2. Frontend lock + upsell

New component `src/components/app/advisor-premium-lock.tsx` — a compact inline
card matching the advisor panel's look (primary-gradient `Card`, `Sparkles` +
"AI Servis Danışmanı" title, `Lock` note, short "Premium özelliği" copy, CTA
button → `/app/billing`). Mobile-first. Presentational (no client state needed).

Gate at the three render sites with a server-computed boolean
`hasAiAdvisor = !!workshop && hasFeature(workshop.planTier as PlanTier, "aiAdvisor")`:

| Render site | Type | Change |
|---|---|---|
| `app/app/orders/new/page.tsx:111` | server | `{hasAiAdvisor ? <StandaloneServiceAdvisor/> : <AdvisorPremiumLock/>}` |
| `app/app/orders/[id]/page.tsx:155` | server | pass `hasAiAdvisor` → `OrderDetail` |
| `app/app/intakes/[id]/page.tsx:43` | server | pass `hasAiAdvisor` → `IntakeDetail` |
| `components/app/order-detail.tsx:357` | client | new `hasAiAdvisor` prop; render panel-or-lock |
| `components/app/intake-detail.tsx:523` | client | new `hasAiAdvisor` prop; render panel-or-lock |

All three pages already destructure `workshop` from `getAppData()`. Technician
order view does not render the advisor → untouched.

**Resulting behavior:** seeded demo workshop is `premium` (`prisma/seed.ts:35`) →
advisor stays visible in `/demo`. Trial signups (`pro`) and `starter` → upsell
lock. Premium → full advisor.

## Part B — Register doc reconciliation (no code-path change)

- **`CLAUDE.md`**: replace "Login has no public register flow" with the accurate
  rule — self-serve signup exists but is an **approval-gated trial application**:
  `/register` creates a workshop in `pending` and grants **no access** until an
  admin approves; no instant public provisioning. Keep forgot-password→support.
- **`middleware.ts:8`**: fix the false "register is intentionally absent /
  redirects to /login" comment to describe `/register` as the public,
  approval-gated trial application (unauth → form; auth → `/app`).
- **`src/app/(auth)/login/actions.ts:14-15`**: fix the false "self-registration
  has been removed / provisioned out-of-band / See README" comment.
- Check README for the same false claim; fix if present.
- Landing + login `/register` links: **unchanged** (kept by design).

## Files touched

**Part A backend:** `src/app/api/advisor/route.ts`, `src/app/api/orders/advisor/route.ts`
**Part A frontend:** `src/components/app/advisor-premium-lock.tsx` (new),
`src/app/app/orders/new/page.tsx`, `src/app/app/orders/[id]/page.tsx`,
`src/app/app/intakes/[id]/page.tsx`, `src/components/app/order-detail.tsx`,
`src/components/app/intake-detail.tsx`
**Part A test:** `src/lib/plan.test.ts` (new — `bun test`, pins `hasFeature` entitlement)
**Part B docs:** `CLAUDE.md`, `middleware.ts`, `src/app/(auth)/login/actions.ts`, (README if needed)

## Out of scope

- Changing the register flow's behavior (kept as approval-gated application).
- Letting trial users sample the advisor (possible future `trialing` toggle).
- Any billing/checkout/PlanPackages changes beyond linking the lock CTA to `/app/billing`.

## Risks

- **Trial users (pro) can't use the advisor** — by design they see the upsell.
  Acceptable per decision; flagged for product awareness.
- 403 vs 500 semantics matter for the client message.
- No DB/migration, no new dependencies → safe to include in the current release.

## Verification

- `bun test` (incl. new `plan.test.ts`), `npm run lint` (eslint), `npm run typecheck` (tsc), `npm run build`.
- Manual QA matrix (premium demo / pro / trial / starter) on order detail, intake
  detail, new-order: advisor visible+working for premium, upsell lock otherwise;
  lock CTA → `/app/billing`; direct `POST` to both advisor APIs as non-premium → 403.
- Register docs: confirm CLAUDE.md + both comments now describe the
  approval-gated application accurately.

Note: project has no route/component test harness (only pure-lib `bun test`:
`totals`, `money`, `cashbox/status`). Route gate + UI conditional are verified via
typecheck/build + manual QA; the pure entitlement contract is unit-tested.

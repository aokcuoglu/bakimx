# Lite acquisition review — issue #626

Implementation branch: `issue/626-lite-acquisition`, based on `d223fe89` (dev). The initial review-ready commit was `77c524f9`. The user subsequently authorized PR/dev integration and localhost:3000 preview. Production configuration/database writes and ad publication remain out of scope. The original checkout and its uncommitted demo/marketing changes were preserved; this branch must be reconciled with that separate marketing work before integration.

## Result

The homepage links to `/fiyatlar#lite`. Pricing and registration describe lifetime 0 TL Lite with no trial or automatic charge. Server-validated plan selection persists through workshop creation; campaign closure blocks new Lite admissions without changing existing grants. Pending registrations cannot silently resume with a different plan. First-use links reuse customer/order forms, and contextual upgrades use unchanged entitlements (Pro 5 seats/5,000 queries; Premium 15/15,000). `/demo` and `/demo/ozet` were not edited.

## Verification

- `bun test`: 2,191 passed, 2 optional DB tests skipped, zero failures. The conversion DB test was separately enabled and passed (14 assertions).
- `bun run typecheck`, `bun run lint`, `git diff --check`: passed.
- All migrations applied successfully to isolated local PostgreSQL. Backend QA exercises campaign open/closed, verification replay, forged selection, paid trial/checkout and conservative/idempotent backfill.
- Chromium: 1440×900 and 360×800 homepage → pricing → annual Lite → all registration steps → successful real API submission. Asserted `planTier=lite`, retained Facebook UTM, first-fold offer, 0 TL in both cycles and no horizontal overflow.
- Existing hero event expectation was updated to the new Lite CTA; no remaining baseline test/type/lint failure observed. Existing Next middleware deprecation and standalone audit push-import warning are unrelated to Lite.

Browser reproduction (only the isolated DB and local app configured in `.env.local`):

```sh
DATABASE_URL=postgresql://bakimx:bakimx@localhost:55432/bakimx_lite_626 LITE_ACQUISITION_E2E=true PLAYWRIGHT_PORT=3026 bunx playwright test e2e/lite-acquisition.e2e.ts
```

## Operations and limitations

See [campaign operations](lite-campaign.md) for `LITE_REGISTRATION_OPEN=true/false`, migration `20260908120000_lite_lifetime_campaign`, Prisma generation/restart and backfill exclusions. All instances must receive the same server configuration. Existing explicit downgrade behavior remains; a stored grant is effective only while on Lite.

See [analytics operations](marketing-analytics.md). No external tracking account/ID was invented. Live GA4 delivery and real card-provider settlement were not tested. Durable transaction conversion rows are authoritative; the one-time browser delivery can undercount if blocked or interrupted. Current unpublished original marketing changes overlap the schema/config/analytics files and require integration review.

Delivery owner: Atlas for PR/dev integration and preserving the primary checkout’s draft marketing work as uncommitted local changes. Cloud deployment remains separately authorized; this PR must not opt in to cloud deployment because the user excluded live database changes. Apply the reviewed migration before any later cloud rollout.

## Changed files

- `.env.example`
- `docs/lite-campaign.md`
- `docs/marketing-analytics.md`
- `e2e/lite-acquisition.e2e.ts`
- `prisma/migrations/20260908120000_lite_lifetime_campaign/migration.sql`
- `prisma/schema.prisma`
- `scripts/qa/lite-campaign.ts`
- `src/app/(app)/appointments/actions.ts`
- `src/app/(app)/billing/actions.ts`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/layout.tsx`
- `src/app/(app)/quotes/actions.ts`
- `src/app/(app)/settings/page.tsx`
- `src/app/(app)/settings/settings-tabs.tsx`
- `src/app/(app)/settings/team/actions.ts`
- `src/app/(auth)/register/page.tsx`
- `src/app/actions/marketing-conversions.ts`
- `src/app/admin/actions.ts`
- `src/app/admin/data.ts`
- `src/app/api/auth/register/route.test.ts`
- `src/app/api/auth/register/route.ts`
- `src/app/api/checkout/route.ts`
- `src/app/api/payments/tami/initiate/route.ts`
- `src/app/api/smart-capture/confirm/route.ts`
- `src/app/fiyatlar/page.tsx`
- `src/app/p/[token]/page.tsx`
- `src/app/p/[token]/pdf/route.ts`
- `src/app/page.test.ts`
- `src/components/analytics/marketing-analytics.tsx`
- `src/components/auth/register-form.tsx`
- `src/components/auth/register-sidebar.tsx`
- `src/components/billing/plan-packages.tsx`
- `src/components/billing/usage-cards.tsx`
- `src/components/sections/HeroSection.tsx`
- `src/components/settings/team-management.tsx`
- `src/lib/auth-login.ts`
- `src/lib/billing/activate.ts`
- `src/lib/billing/lifecycle.ts`
- `src/lib/billing/verify-activation.ts`
- `src/lib/calendar/reminder-scheduler.ts`
- `src/lib/communications/scheduler.ts`
- `src/lib/emails/system-emails.ts`
- `src/lib/lite-campaign.test.ts`
- `src/lib/lite-campaign.ts`
- `src/lib/marketing-analytics.test.ts`
- `src/lib/marketing-analytics.ts`
- `src/lib/marketing-conversion-outbox.integration.test.ts`
- `src/lib/marketing-conversion-outbox.test.ts`
- `src/lib/marketing-conversion-outbox.ts`
- `src/lib/orders/create-service-order.ts`
- `src/lib/plan.ts`
- `src/lib/plans-catalog.test.ts`
- `src/lib/plans-catalog.ts`
- `src/lib/rbac.ts`
- `src/lib/validations/auth.ts`

# Lite acquisition campaign — #626

## Server configuration

`LITE_REGISTRATION_OPEN=true` admits new Lite workshops. Unset keeps the existing open offer; `false`, empty or malformed configured values close admissions. The variable is server-side, read at creation time, independent of feature/access gates. Apply the same value to every app instance and restart/redeploy configuration consistently. No production configuration was changed by this task.

Closing admissions rejects new Lite `/api/auth/register`, legacy `/api/checkout` and in-app first Lite purchases. A registration already committed can still resend verification and complete activation after closure. The API returns `lite_registration_closed` with an explicit explanation; it never substitutes a paid plan.

## Schema and deployment preparation

Before this code is deployed, apply the reviewed migration `20260908120000_lite_lifetime_campaign` using the repository's normal `prisma migrate deploy` procedure, regenerate Prisma Client and restart the app. Do not use `db:push` in production. This task only applied migrations to disposable local PostgreSQL `localhost:55432/bakimx_lite_626`.

`Workshop.liteFreeGrantedAt` records the permanent Lite entitlement. Registration writes it inside the same transaction as the workshop and owner. The migration is idempotent: it grants existing customer Lite workshops only when no positive confirmed/pending billing order and no positive live/completed purchase transaction exists. Ambiguous/paid Lite records are skipped for human review; Pro/Premium/Starter records are never converted. Backfill clears trial and period expiry but preserves approval/rejection gates.

The entitlement remains valid regardless of campaign configuration, future catalog prices, stale subscription status or expiry dates while the workshop is on Lite. Login, write, feature and seat guards consume it. Lifecycle reminder/purge sweeps exclude granted Lite workshops. Suspended or unverified workshops remain blocked. Lite does not acquire trial Premium permissions.

## Billing and package changes

Self-service Lite signup creates no billing order, payment transaction, card mandate or trial. Legacy free checkout keeps the existing zero-price order flow, but activation sets no trial or finite subscription period. Paid registration keeps its existing seven business day verification-triggered trial. Paid checkout, existing payment confirmation and price/limit sources remain unchanged.

Existing explicit upgrade/downgrade order behavior is preserved. The grant is retained when upgrading but grants no free Pro/Premium access. Returning to Lite through the existing user-confirmed downgrade flow restores the stored free Lite entitlement; closure blocks a new Lite admission without a historical grant. No new automatic downgrade, payment or package-selection policy is introduced.

## Reproducible backend QA

`bun test src/lib/lite-campaign.test.ts src/app/api/auth/register/route.test.ts src/lib/billing/pricing.test.ts src/lib/plan.test.ts`

`bun scripts/qa/lite-campaign.ts` refuses any database other than disposable `localhost:55432/bakimx_lite_626`. It creates clearly labeled test fixtures and requires a local Next server with open admissions (`QA_BASE_URL`, default `http://localhost:3026`). It covers creation, closure, forged tier/grant rejection, authenticated verification resume after closure, activation replay, no Lite trial/payment, paid registration and checkout, real HTTP free checkout activation, and conservative migration replay. CLI activation audit logs emit a pre-existing Next-only `server-only` push-import warning; the audit row and activation succeed. HTTP activation checks exercise the actual Next runtime.

# Marketing analytics operations

The client contract is disabled by default. Set `NEXT_PUBLIC_ANALYTICS_ENABLED=true` to emit the `bakimx:analytics` browser event. Set `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-…` to additionally load the built-in GA4 adapter. With no measurement ID, another provider may consume the browser event without changing product code.

AWS deployment builds read environment-specific GitHub repository variables:

- dev: `DEV_NEXT_PUBLIC_ANALYTICS_ENABLED`, `DEV_NEXT_PUBLIC_GA_MEASUREMENT_ID`
- production: `PROD_NEXT_PUBLIC_ANALYTICS_ENABLED`, `PROD_NEXT_PUBLIC_GA_MEASUREMENT_ID`

Both deploy workflows fail before image construction unless the enable flag is exactly `true` and the measurement ID has a `G-…` shape. These values are compiled into the browser bundle and cannot be supplied later through the ECS task definition.

Payloads are allowlisted in `src/lib/marketing-analytics.ts`. Never add names, email addresses, phone numbers, business/invoice details, addresses, notes, full URLs, or free text. `source_page` is pathname-only and `referrer_host` is hostname-only. Keep GA4 enhanced measurement and automatic page views disabled to avoid duplicate page events.

## Release verification

1. Use a non-production GA4 property and enable both variables in a preview deployment.
2. Open GA4 DebugView or Tag Assistant, clear the browser session, and visit an allowlisted landing with test UTM parameters.
3. Exercise landing → CTA → register/demo/purchase once. Confirm one event per action, version `1`, and no form values in the payload/network request. Repeat a failed API response and confirm no submitted event.
4. Double-click each submit control and confirm one request and one success event. Navigate away/back and confirm no React re-render duplicate for the same landing route.
5. After release, reconcile daily `demo_submitted`, `register_submitted`, and `purchase_submitted` totals with PII-free database aggregates. Investigate differences over 5%. Start the BAK-171 baseline only after validation; freeze the first 28 complete days.

## Lite acquisition (issue #626)

The Facebook/Instagram funnel uses the existing event bus and GA4 adapter:

| Step | Event | Success boundary / deduplication |
| --- | --- | --- |
| Pricing visit | `seo_landing_view`, `landing_type=pricing` | Existing route observer |
| Lite registration CTA | `lite_cta_click` | Explicit CTA click |
| Registration starts | `register_started`, optional `plan_tier=lite` | Existing register observer |
| Lite workshop created | `lite_registered` | Workshop creation transaction; one record per workshop |
| First work order | `first_work_order_created` | First order transaction, including intake, quote and appointment conversion; one per workshop |
| Upgrade intent | `feature_upgrade_clicked` / `purchase_started` | Existing explicit user actions; no payment success inferred |
| Verified paid activation | `paid_subscription_confirmed` | Confirmed positive-value new purchase/upgrade transaction; one per billing order; renewals excluded |

`purchase_submitted` still means a submitted payment/order, **not** a verified paid subscription. Reconcile paid conversions with confirmed billing orders, never with thank-you page views.

Successful conversions are recorded within the business transaction in the existing `AuditLog` table (`entityType=MarketingConversion`). Their deterministic hashed event IDs are protected by the existing primary key and `createMany(skipDuplicates)`. Rollback cannot leave a successful conversion behind. No tracking table or migration is required. Attribution is sanitized before persistence; entity IDs and customer/workshop/contact details are not sent to the analytics provider.

The existing analytics component claims conversions after the authenticated owner reaches dashboard, orders, billing or settings; focus and a 30-second check also capture same-route mutations. A second audit record (`MarketingConversionClaim`) atomically makes browser handoff **at most once**, including multiple tabs or reloads. Claims exclude impersonation and accounts requiring a password change. Tracking failures cannot change a plan, start a payment or block onboarding. A closed tab, lost response, ad blocker or failed provider after claim can undercount; exactly-once provider delivery is not claimed. The persisted conversion records remain the reconciliation source. Events may arrive on the owner's next eligible app visit after an administrator/payment callback confirms the subscription.

With `NEXT_PUBLIC_ANALYTICS_ENABLED=true`, public home/pricing/register capture the first valid campaign in the existing `bakimx:marketing-attribution` localStorage key. Registration submits only sanitized `campaignSource`, `campaignMedium`, `campaignName`, and an allowlisted landing path. Use campaign slugs beginning with a letter and containing letters, digits, `_`, `-`, or `.` (100 characters maximum). Contact values, arbitrary free text, click identifiers (`gclid`, `fbclid`), query strings and personal pages are rejected. Collection follows the existing enable flag; no new consent system is introduced. Disabled analytics neither reads/writes attribution nor creates conversion audit rows. Clear that storage key when intentionally resetting first-touch attribution for a QA run.

No service account, advertising pixel or tracking ID is created by this task. Actual GA4 delivery still requires the existing deployment configuration and an accessible non-production property for DebugView validation. No Meta CAPI or enhanced-conversion contact data is sent by the Lite funnel. Existing unrelated demo analytics work is outside this change.


Local database verification: run `LITE_ANALYTICS_DB_TESTS=true bun test src/lib/marketing-conversion-outbox.integration.test.ts` with `DATABASE_URL` pointing to the isolated local `bakimx_lite_626` database. The test refuses remote/other databases and deletes only its own fixtures. It verifies transaction rollback, concurrent conversion/claim deduplication, first-versus-second order behavior, owner-only access, impersonation exclusion and tenant isolation. The unit/instrumentation tests run without database access.

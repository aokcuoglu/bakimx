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

# Demo advertising attribution (#649)

The master flag `NEXT_PUBLIC_ANALYTICS_ENABLED=true` and explicit targeting-cookie consent are both required. Performance consent alone never permits advertising. Google Ads configuration additionally requires `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID` (AW-number) and `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL`. Defaults are disabled and empty. Meta Pixel/CAPI and enhanced contact conversions are not implemented.

These public values are **build-time** Next.js variables: changing runtime ECS environment alone cannot update a compiled browser bundle. The Docker builder accepts empty-default Ads ARG/ENV values. The dev workflow passes optional repository variables `DEV_NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID` and `DEV_NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL`; missing values remain empty and do not fail deployment. This change does not set GitHub variables, add a required Ads configuration gate, or alter the production workflow. Production activation requires a separate approved release/configuration change.

Only `/`, `/demo`, and `/demo/ozet` can bootstrap advertising. An optional separate browser key `bakimx:demo-attribution` retains the first accepted campaign/click-ID attribution; consent withdrawal or master-off clears it. The API independently checks the master flag and submitted targeting choice before accepting whitelisted attribution into nullable SalesLead columns. `attributionRecordedAt` is server receipt time, not a fabricated first-click time. Existing leads stay null. The existing authorized CRM list displays campaign labels, never click IDs.

The demo API returns an unrelated UUID only after successful persistence. The browser sends one explicit Google Ads conversion per UUID, using `transaction_id` for provider deduplication. Generic GA events have explicit `send_to` routing to prevent the added Ads destination receiving unrelated funnel events. Form phone/name/business/notes, hashed contact data, and CRM IDs/stages are never passed to advertising. Configuration and events explicitly set query-free `page_location`, empty `page_referrer`, and disable enhanced conversions. Script HTTP referrer is suppressed. PageView is disabled. Both `ad_storage` and `ad_user_data` are granted only with explicit targeting consent on allowed demo routes: Google requires these flags for pseudonymous click-ID conversion measurement. This does not enable phone/email collection: enhanced conversions stay off, explicit event `user_data` stays null, and no form contacts enter the tag. `ad_personalization` remains denied. Revocation denies both measurement flags and removes the local event listener; private routes deny both flags too.

This is pseudonymous click attribution, not a promise of anonymous transport: an enabled third-party SDK still makes browser network requests (including the browser's IP). Previously accepted provider events cannot be recalled by withdrawing browser consent. No actual advertising configuration or production changes are part of this PR.

## References

- [Google conversion measurement](https://developers.google.com/tag-platform/devguides/conversions)
- [Google event routing](https://developers.google.com/tag-platform/gtagjs/routing)
- [Google Consent Mode parameter semantics](https://support.google.com/tagmanager/answer/13802165?hl=en)
- [Google tag consent API](https://developers.google.com/tag-platform/gtagjs/reference#consent)

## Verification

`bun test`, `bun run lint`, `bun run typecheck`, `bun run build`, `bun run db:validate`.

Provider-isolated browser acceptance:

```sh
NEXT_PUBLIC_ANALYTICS_ENABLED=true NEXT_PUBLIC_GA_MEASUREMENT_ID=G-TEST123 NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID=AW-123456789 NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL=test_demo PLAYWRIGHT_PORT=3219 bunx playwright test e2e/demo-marketing.e2e.ts
```

Tests fulfill all advertising requests locally; never use real configured provider IDs for QA. The extra advertising test is skipped without this explicit fixture configuration. Migration is additive; deploying a previous application version tolerates these nullable columns. Merge to dev requires `[deploy-dev]` so migration deploy precedes the new app. Production execution remains a separate human gate.

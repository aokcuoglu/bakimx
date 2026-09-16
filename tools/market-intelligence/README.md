# Apify Market Intelligence Pilot

Issue: [#665](https://github.com/aokcuoglu/bakimx/issues/665). This is a standalone marketing research utility. It has no application runtime, Prisma, scheduler, or production dependency.

## Commands

- `bun run market:intel:preflight`: checks `APIFY_API_TOKEN`, connectivity, monthly usage, and remaining credit. Starts no Actor.
- `bun run market:intel:competitors`: crawls BakımX, PADOK/Hayat Yazılım, ServisData, and Kursoft with the official Website Content Crawler, Cheerio mode, at most 8 pages and depth 2 per site.
- `bun run market:intel:analyze`: rebuilds JSON, CSV, and Markdown from local normalized datasets and `curation.json`; makes no network request.
- `bun run market:intel:phase2`: performs a separate preflight and runs one bounded Google Search Actor for seven brand/category queries. Its run is capped at $0.50, the Actor's current minimum cap. It does not run Meta Ads because the official Actor forces residential proxies internally.
- `bun run market:intel:phase2:analyze`: rebuilds the Phase 2 report and local CSV from the existing ignored dataset; makes no network request.

Set `APIFY_API_TOKEN` in an ignored local env file or process environment. Never paste it into a command argument. Optional `APIFY_MONTHLY_CREDIT_USD` and `APIFY_PILOT_BUDGET_USD` default to 5 and 0.50, with hard ceilings of those values. The live command checks current monthly usage before each new Actor run; it stops at $4.50 monthly usage or $0.50 pilot spend. Each run has a separate $0.12 Apify charge cap. Existing local datasets and run IDs are reused so an interrupted command does not start a duplicate run. An Actor failure is recorded and is never retried automatically.

Raw normalized pages and the run manifest are stored under ignored `tmp/market-intelligence/`. Only curated, source-linked findings and aggregate output under `tools/market-intelligence/output/` are intended for review. Edit `curation.json` after reading the raw pages, then rerun `market:intel:analyze`. Every non-unverified claim must cite a collected URL; the report generator enforces this.

The Actor fields were checked against the [official input schema](https://apify.com/apify/website-content-crawler/input-schema). The Actor requires proxy configuration; an empty group list uses the default [datacenter proxy](https://docs.apify.com/proxy/datacenter-proxy). Cost and API behavior were checked against [monthly usage](https://docs.apify.com/api/v2/users-me-usage-monthly-get), [Run Actor](https://docs.apify.com/api/v2/actors-runs-post), and [Get run](https://docs.apify.com/api/v2/actor-run-get). The Actor runs do not use AI summarization, browser rendering, residential proxy, or file downloads.

Phase 2 uses the [official Google Search Actor input schema](https://apify.com/apify/google-search-scraper/input-schema): one page per query, Turkish country/language, no paid ads or AI/content/lead add-ons, no HTML snapshots. It validates input with Apify before a run and reads the Actor's current minimum `maxTotalChargeUsd` from its pricing metadata. Normalized SERP JSON, CSV, and run manifest are ignored under `tmp/market-intelligence/phase2/`; the Markdown report is under `output/`. The [official Meta Actor developer says it enforces residential proxies internally](https://apify.com/apify/facebook-ads-scraper/issues/residential-proxy-fo-YD0alNTBZG9sg23yG), so this pilot records Meta as unverified and does not start that Actor.

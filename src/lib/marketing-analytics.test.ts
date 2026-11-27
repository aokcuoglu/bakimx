import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { getMarketingContext, isMarketingEventName, MARKETING_EVENT_NAMES, safePage, sanitizeMarketingPayload, sanitizeMarketingAttribution } from "./marketing-analytics"

describe("marketing analytics contract", () => {
  test("keeps the BAK-171 event dictionary stable", () => {
    expect(MARKETING_EVENT_NAMES).toEqual([
      "seo_landing_view", "trial_cta_click", "demo_cta_click", "register_started",
      "register_submitted", "demo_form_started", "demo_submitted", "purchase_started", "purchase_submitted",
      "feature_paywall_viewed", "feature_upgrade_clicked",
      "first_work_order_created", "paid_subscription_confirmed",
    ])
    expect(MARKETING_EVENT_NAMES).toHaveLength(13)
  })

  test("emekli bir olay adı sözlükte sayılmaz (#830)", () => {
    for (const name of MARKETING_EVENT_NAMES) expect(isMarketingEventName(name)).toBe(true)
    expect(isMarketingEventName("retired_event")).toBe(false)
    expect(isMarketingEventName(undefined)).toBe(false)
    expect(isMarketingEventName(42)).toBe(false)
  })

  test("tarayıcı teslim döngüsü emekli adı atlar, partinin kalanını düşürmez (#830)", () => {
    const source = readFileSync(join(import.meta.dir, "..", "components", "analytics", "marketing-analytics.tsx"), "utf8")
    expect(source).toContain("if (!isMarketingEventName(event.name)) continue")
  })

  test("only derives allowlisted campaign and referrer fields", () => {
    const context = getMarketingContext(
      { pathname: "/register", search: "?utm_source=google&utm_medium=cpc&utm_campaign=summer&email=secret@example.com&name=Ali" } as Location,
      "https://search.example/results?q=private",
    )
    expect(context).toEqual({
      source_page: "/register", campaign_source: "google", campaign_medium: "cpc",
      campaign_name: "summer", referrer_host: "search.example",
    })
    expect(JSON.stringify(context)).not.toContain("secret@example.com")
    expect(JSON.stringify(context)).not.toContain("private")
  })

  test("removes query and fragment from source_page", () => {
    expect(safePage("/demo?email=a@b.com#note")).toBe("/demo")
  })

  test("drops unexpected PII at runtime even if a caller bypasses TypeScript", () => {
    const payload = sanitizeMarketingPayload("demo_submitted", {
      form_location: "home", email: "secret@example.com", phone: "5551234567", notes: "private",
    } as never)
    expect(payload).toEqual({ form_location: "home" })
  })

  test("register analytics describes onboarding without package or billing fields", () => {
    const payload = sanitizeMarketingPayload("register_submitted", {
      sector: "auto_service",
      team_size: "2_5",
      module_count: "7",
      plan_tier: "pro",
      billing_cycle: "monthly",
    } as never)
    expect(payload).toEqual({ sector: "auto_service", team_size: "2_5", module_count: "7" })
  })

  test("paywall analytics keeps only non-PII feature and plan dimensions", () => {
    const payload = sanitizeMarketingPayload("feature_upgrade_clicked", {
      feature_id: "vinLookup",
      current_tier: "pro",
      kind: "addon",
      placement: "page",
      destination: "contact",
      email: "secret@example.com",
      workshop_name: "Private Garage",
    } as never)
    expect(payload).toEqual({
      feature_id: "vinLookup",
      current_tier: "pro",
      kind: "addon",
      placement: "page",
      destination: "contact",
    })
  })

  test("paywall analytics no longer carries a purchasable target tier (#782)", () => {
    const payload = sanitizeMarketingPayload("feature_paywall_viewed", {
      feature_id: "appointments",
      current_tier: "lite",
      kind: "package",
      placement: "inline",
      target_tier: "premium",
    } as never)
    expect(payload).toEqual({ feature_id: "appointments", current_tier: "lite", kind: "package", placement: "inline" })
  })

  test("satır içi ek özellik notu atölye paketi olmadan ölçülür (#829)", () => {
    const payload = sanitizeMarketingPayload("feature_upgrade_clicked", {
      feature_id: "vinLookup",
      kind: "addon",
      placement: "inline",
      destination: "addon_purchase",
    })
    expect(payload).toEqual({ feature_id: "vinLookup", kind: "addon", placement: "inline", destination: "addon_purchase" })
  })
})


describe("Lite attribution minimization", () => {
  test("accepts campaign slugs and allowlisted landing paths only", () => {
    expect(sanitizeMarketingAttribution({ campaignSource: "facebook", campaignMedium: "paid-social", campaignName: "lite_2026", landingPage: "/fiyatlar", email: "private@example.com", fbclid: "private-click-id" })).toEqual({ campaignSource: "facebook", campaignMedium: "paid-social", campaignName: "lite_2026", landingPage: "/fiyatlar" })
  })
  test("rejects malformed storage, free text, contact values and private URLs", () => {
    for (const input of [null, [], "string", { campaignSource: "private@example.com", campaignMedium: "+905551234567", campaignName: "Customer name", landingPage: "/customers/private?email=secret" }]) expect(sanitizeMarketingAttribution(input)).toEqual({})
  })
})


test("UTM context and caller payload both reject contact data", () => {
  expect(getMarketingContext({ pathname: "/fiyatlar", search: "?utm_source=secret%40example.com&utm_medium=5551234567&utm_campaign=Customer%20Name" }, "")).toEqual({ source_page: "/fiyatlar" })
  expect(sanitizeMarketingPayload("trial_cta_click", { cta_location: "pricing_card", plan_tier: "pro", campaign_source: "secret@example.com", campaign_medium: "5551234567" })).toEqual({ cta_location: "pricing_card", plan_tier: "pro" })
})

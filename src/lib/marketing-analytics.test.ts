import { describe, expect, test } from "bun:test"
import { getMarketingContext, MARKETING_EVENT_NAMES, safePage, sanitizeMarketingPayload } from "./marketing-analytics"

describe("marketing analytics contract", () => {
  test("keeps the BAK-171 event dictionary stable", () => {
    expect(MARKETING_EVENT_NAMES).toEqual([
      "seo_landing_view", "trial_cta_click", "demo_cta_click", "register_started",
      "register_submitted", "demo_submitted", "purchase_started", "purchase_submitted",
    ])
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
})

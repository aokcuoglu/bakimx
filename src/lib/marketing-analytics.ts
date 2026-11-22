import { hasPerformanceConsent } from "./cookie-consent"

export const MARKETING_EVENT_NAMES = [
  "seo_landing_view", "trial_cta_click", "demo_cta_click", "register_started",
  "register_submitted", "demo_form_started", "demo_submitted", "purchase_started", "purchase_submitted",
  "feature_paywall_viewed", "feature_upgrade_clicked",
  "lite_cta_click", "lite_registered", "first_work_order_created", "paid_subscription_confirmed",
] as const

export type MarketingEventName = (typeof MARKETING_EVENT_NAMES)[number]
export type PlanTier = "lite" | "starter" | "pro" | "premium"
export type BillingCycle = "monthly" | "yearly"
export type FeaturePlacement = "page" | "inline"

type Common = {
  source_page?: string
  cta_location?: string
  campaign_source?: string
  campaign_medium?: string
  campaign_name?: string
  event_id?: string
  referrer_host?: string
}

export type MarketingEventPayloads = {
  lite_cta_click: Common & { cta_location: string; plan_tier: "lite" }
  lite_registered: Common & { plan_tier: "lite" }
  first_work_order_created: Common & { plan_tier: PlanTier }
  paid_subscription_confirmed: Common & { plan_tier: PlanTier; billing_cycle: BillingCycle }
  seo_landing_view: Common & { landing_type: "home" | "product" | "pricing" | "demo" }
  trial_cta_click: Common & { cta_location: string; plan_tier?: PlanTier }
  demo_cta_click: Common & { cta_location: string; destination: "form" | "assistant" | "callback_modal" }
  register_started: Common & { entry_step: "sector" | "account"; plan_tier?: PlanTier }
  register_submitted: Common & {
    entry_step?: "account"
    sector?:
      | "auto_service"
      | "mechanical_service"
      | "body_paint"
      | "spare_parts"
      | "tire_service"
      | "auto_electric"
    team_size?: "solo" | "2_5" | "6_10" | "11_25" | "26_50" | "50_plus"
    module_count?: string
  }
  demo_form_started: Common & { form_location: "home" | "demo_page" }
  demo_submitted: Common & {
    form_location: "home" | "demo_page" | "assistant" | "register_coming_soon_sector"
  }
  purchase_started: Common & { plan_tier: PlanTier; billing_cycle: BillingCycle; cta_location: "pricing_card" }
  purchase_submitted: Common & { plan_tier: PlanTier; billing_cycle: BillingCycle; payment_method: "card" | "havale" }
  feature_paywall_viewed: Common & {
    feature_id: string
    current_tier: PlanTier
    target_tier: "pro" | "premium"
    placement: FeaturePlacement
  }
  feature_upgrade_clicked: Common & {
    feature_id: string
    current_tier: PlanTier
    target_tier: "pro" | "premium"
    placement: FeaturePlacement
    destination: "checkout" | "plans"
  }
}

export type MarketingEventDetail<N extends MarketingEventName = MarketingEventName> = {
  name: N
  params: MarketingEventPayloads[N] & { event_version: 1 }
}

const CAMPAIGN_KEYS = {
  utm_source: "campaign_source", utm_medium: "campaign_medium", utm_campaign: "campaign_name",
} as const

const COMMON_FIELDS = ["source_page", "cta_location", "campaign_source", "campaign_medium", "campaign_name", "referrer_host", "event_id"] as const
const EVENT_FIELDS: Record<MarketingEventName, readonly string[]> = {
  lite_cta_click: ["plan_tier"],
  lite_registered: ["plan_tier"],
  first_work_order_created: ["plan_tier"],
  paid_subscription_confirmed: ["plan_tier", "billing_cycle"],
  seo_landing_view: ["landing_type"],
  trial_cta_click: ["plan_tier"],
  demo_cta_click: ["destination"],
  register_started: ["entry_step", "plan_tier"],
  register_submitted: ["entry_step", "sector", "team_size", "module_count"],
  demo_form_started: ["form_location"],
  demo_submitted: ["form_location"],
  purchase_started: ["plan_tier", "billing_cycle"],
  purchase_submitted: ["plan_tier", "billing_cycle", "payment_method"],
  feature_paywall_viewed: ["feature_id", "current_tier", "target_tier", "placement"],
  feature_upgrade_clicked: ["feature_id", "current_tier", "target_tier", "placement", "destination"],
}

export function sanitizeMarketingPayload<N extends MarketingEventName>(name: N, payload: MarketingEventPayloads[N]) {
  const input = payload as Record<string, unknown>
  const safe: Record<string, unknown> = {}
  for (const key of [...COMMON_FIELDS, ...EVENT_FIELDS[name]]) {
    const value = input[key]
    if (typeof value === "string" && value.length > 0) {
      if (key.startsWith("campaign_") && !/^[a-zA-Z][a-zA-Z0-9_.-]{0,99}$/.test(value)) continue
      safe[key] = value.slice(0, 253)
    }
  }
  if (typeof safe.source_page === "string") safe.source_page = safePage(safe.source_page)
  return safe as MarketingEventPayloads[N]
}

export function safePage(pathname: string) {
  return pathname.startsWith("/") ? pathname.split(/[?#]/, 1)[0] : "/"
}

export function getMarketingContext(location: Pick<Location, "pathname" | "search">, referrer: string) {
  const params = new URLSearchParams(location.search)
  const context: Common = { source_page: safePage(location.pathname) }
  for (const [utm, key] of Object.entries(CAMPAIGN_KEYS)) {
    const value = params.get(utm)?.trim().slice(0, 100)
    if (value && /^[a-zA-Z][a-zA-Z0-9_.-]{0,99}$/.test(value)) context[key as keyof Common] = value
  }
  if (referrer) {
    try { context.referrer_host = new URL(referrer).hostname.slice(0, 253) } catch { /* invalid referrer */ }
  }
  return context
}

export function trackMarketingEvent<N extends MarketingEventName>(name: N, payload: MarketingEventPayloads[N]) {
  if (typeof window === "undefined" || process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true") return false
  // Performance cookies require an explicit public-site consent choice.
  if (!hasPerformanceConsent()) return false
  const detail: MarketingEventDetail<N> = {
    name,
    params: {
      ...getMarketingContext(window.location, document.referrer),
      ...sanitizeMarketingPayload(name, payload),
      event_version: 1,
    },
  }
  window.dispatchEvent(new CustomEvent<MarketingEventDetail>("bakimx:analytics", { detail }))
  return true
}

// Share the attribution key/shape with the existing marketing acquisition work.
export type MarketingAttribution = { campaignSource?: string; campaignMedium?: string; campaignName?: string; landingPage?: string }
const ATTRIBUTION_STORAGE_KEY = "bakimx:marketing-attribution"

/** Campaign labels only; never persist click IDs, arbitrary form fields or URLs. */
export function sanitizeMarketingAttribution(input: unknown): MarketingAttribution {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {}
  const raw = input as Record<string, unknown>
  const safe: MarketingAttribution = {}
  for (const key of ["campaignSource", "campaignMedium", "campaignName"] as const) {
    const value = raw[key]
    // Require campaign slugs. Reject likely email, telephone, URL and free text.
    if (typeof value === "string" && /^[a-zA-Z][a-zA-Z0-9_.-]{0,99}$/.test(value)) safe[key] = value
  }
  if (typeof raw.landingPage === "string" && ["/", "/fiyatlar", "/register"].includes(raw.landingPage)) safe.landingPage = raw.landingPage
  return safe
}

export function getStoredMarketingAttribution(): MarketingAttribution {
  if (typeof window === "undefined" || process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true") return {}
  if (!hasPerformanceConsent()) return {}
  try { return sanitizeMarketingAttribution(JSON.parse(window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY) || "{}")) } catch { return {} }
}

export function captureMarketingAttribution() {
  if (typeof window === "undefined" || process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true") return
  if (!hasPerformanceConsent()) return
  const existing = getStoredMarketingAttribution()
  if (existing.campaignSource || existing.campaignMedium || existing.campaignName) return
  const query = new URLSearchParams(window.location.search)
  const current = sanitizeMarketingAttribution({ campaignSource: query.get("utm_source"), campaignMedium: query.get("utm_medium"), campaignName: query.get("utm_campaign"), landingPage: window.location.pathname })
  if (!current.campaignSource && !current.campaignMedium && !current.campaignName) return
  try { window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(current)) } catch { /* Storage is optional. */ }
}

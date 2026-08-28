export const MARKETING_EVENT_NAMES = [
  "seo_landing_view", "trial_cta_click", "demo_cta_click", "register_started",
  "register_submitted", "demo_submitted", "purchase_started", "purchase_submitted",
] as const

export type MarketingEventName = (typeof MARKETING_EVENT_NAMES)[number]
export type PlanTier = "lite" | "starter" | "pro" | "premium"
export type BillingCycle = "monthly" | "yearly"

type Common = {
  source_page?: string
  cta_location?: string
  campaign_source?: string
  campaign_medium?: string
  campaign_name?: string
  referrer_host?: string
}

export type MarketingEventPayloads = {
  seo_landing_view: Common & { landing_type: "home" | "product" | "pricing" | "demo" }
  trial_cta_click: Common & { cta_location: string; plan_tier?: PlanTier }
  demo_cta_click: Common & { cta_location: string; destination: "form" | "assistant" }
  register_started: Common & { entry_step: "sector" }
  register_submitted: Common & {
    sector: "auto_service"
    team_size: "solo" | "2_5" | "6_10" | "11_25" | "26_50" | "50_plus"
    module_count: string
  }
  demo_submitted: Common & { form_location: "home" | "demo_page" | "assistant" }
  purchase_started: Common & { plan_tier: PlanTier; billing_cycle: BillingCycle; cta_location: "pricing_card" }
  purchase_submitted: Common & { plan_tier: PlanTier; billing_cycle: BillingCycle; payment_method: "card" | "havale" }
}

export type MarketingEventDetail<N extends MarketingEventName = MarketingEventName> = {
  name: N
  params: MarketingEventPayloads[N] & { event_version: 1 }
}

const CAMPAIGN_KEYS = {
  utm_source: "campaign_source", utm_medium: "campaign_medium", utm_campaign: "campaign_name",
} as const

const COMMON_FIELDS = ["source_page", "cta_location", "campaign_source", "campaign_medium", "campaign_name", "referrer_host"] as const
const EVENT_FIELDS: Record<MarketingEventName, readonly string[]> = {
  seo_landing_view: ["landing_type"],
  trial_cta_click: ["plan_tier"],
  demo_cta_click: ["destination"],
  register_started: ["entry_step"],
  register_submitted: ["sector", "team_size", "module_count"],
  demo_submitted: ["form_location"],
  purchase_started: ["plan_tier", "billing_cycle"],
  purchase_submitted: ["plan_tier", "billing_cycle", "payment_method"],
}

export function sanitizeMarketingPayload<N extends MarketingEventName>(name: N, payload: MarketingEventPayloads[N]) {
  const input = payload as Record<string, unknown>
  const safe: Record<string, unknown> = {}
  for (const key of [...COMMON_FIELDS, ...EVENT_FIELDS[name]]) {
    const value = input[key]
    if (typeof value === "string" && value.length > 0) safe[key] = value.slice(0, 253)
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
    if (value) context[key as keyof Common] = value
  }
  if (referrer) {
    try { context.referrer_host = new URL(referrer).hostname.slice(0, 253) } catch { /* invalid referrer */ }
  }
  return context
}

export function trackMarketingEvent<N extends MarketingEventName>(name: N, payload: MarketingEventPayloads[N]) {
  if (typeof window === "undefined" || process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true") return false
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

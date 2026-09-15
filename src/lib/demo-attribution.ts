import { readCookieConsent } from "./cookie-consent"
import { sanitizeMarketingAttribution } from "./marketing-analytics"

export const DEMO_ATTRIBUTION_KEY = "bakimx:demo-attribution"
export type DemoAttribution = ReturnType<typeof sanitizeMarketingAttribution> & { gclid?: string; fbclid?: string }

export function hasDemoAdvertisingConsent() {
  return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true" && readCookieConsent()?.preferences.targeting === true
}

/** Separate from Lite attribution: click IDs never enter registration analytics. */
export function sanitizeDemoAttribution(input: unknown): DemoAttribution {
  const result: DemoAttribution = sanitizeMarketingAttribution(input)
  if (!input || typeof input !== "object" || Array.isArray(input)) return result
  const raw = input as Record<string, unknown>
  for (const key of ["gclid", "fbclid"] as const) {
    if (typeof raw[key] === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(raw[key])) result[key] = raw[key]
  }
  if (typeof raw.landingPage === "string" && ["/", "/demo", "/demo/ozet"].includes(raw.landingPage)) result.landingPage = raw.landingPage
  return result
}

export function captureDemoAttribution() {
  if (typeof window === "undefined") return
  if (!hasDemoAdvertisingConsent()) {
    try { window.localStorage.removeItem(DEMO_ATTRIBUTION_KEY) } catch { /* Optional storage. */ }
    return
  }
  if (!["/", "/demo", "/demo/ozet"].includes(window.location.pathname)) return
  const existing = getDemoAttribution()
  if (existing.gclid || existing.fbclid || existing.campaignSource || existing.campaignName || existing.campaignMedium) return
  const query = new URLSearchParams(window.location.search)
  const current = sanitizeDemoAttribution({ campaignSource: query.get("utm_source"), campaignMedium: query.get("utm_medium"), campaignName: query.get("utm_campaign"), gclid: query.get("gclid"), fbclid: query.get("fbclid"), landingPage: window.location.pathname })
  if (!current.gclid && !current.fbclid && !current.campaignSource && !current.campaignName && !current.campaignMedium) return
  try { window.localStorage.setItem(DEMO_ATTRIBUTION_KEY, JSON.stringify(current)) } catch { /* Optional storage. */ }
}

export function getDemoAttribution(): DemoAttribution {
  if (typeof window === "undefined" || !hasDemoAdvertisingConsent()) return {}
  try { return sanitizeDemoAttribution(JSON.parse(window.localStorage.getItem(DEMO_ATTRIBUTION_KEY) || "{}")) } catch { return {} }
}

/** An opaque submission ID deduplicates advertising events; no contact/CRM data. */
export function trackDemoAdvertisingConversion(eventId: string) {
  if (typeof window === "undefined" || !hasDemoAdvertisingConsent() || !/^[a-f0-9-]{36}$/.test(eventId)) return false
  window.dispatchEvent(new CustomEvent("bakimx:demo-conversion", { detail: { eventId } }))
  return true
}

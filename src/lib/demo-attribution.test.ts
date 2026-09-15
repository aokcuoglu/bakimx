import { afterEach, describe, expect, test } from "bun:test"
import { COOKIE_CONSENT_STORAGE_KEY, createConsentRecord } from "./cookie-consent"
import { captureDemoAttribution, DEMO_ATTRIBUTION_KEY, getDemoAttribution, sanitizeDemoAttribution, trackDemoAdvertisingConversion } from "./demo-attribution"

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
const previousFlag = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED
function browser(targeting: boolean, enabled = "true") {
  const storage = new Map<string, string>()
  const events: unknown[] = []
  storage.set(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(createConsentRecord({ necessary: true, performance: true, targeting, functional: false })))
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: { pathname: "/demo", search: "?utm_source=google&gclid=test-click" },
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
    dispatchEvent: (event: unknown) => events.push(event),
  } })
  process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = enabled
  return { storage, events }
}
afterEach(() => {
  if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow)
  else Reflect.deleteProperty(globalThis, "window")
  if (previousFlag === undefined) delete process.env.NEXT_PUBLIC_ANALYTICS_ENABLED
  else process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = previousFlag
})
describe("demo advertising attribution", () => {
  test("rejects contact fields, unsafe click IDs, arbitrary URL and campaign PII", () => {
    expect(sanitizeDemoAttribution({ phone: "5551234567", email: "secret@example.com", campaignSource: "secret@example.com", gclid: "test@example.com", fbclid: "valid_click", landingPage: "/demo?email=secret" })).toEqual({ fbclid: "valid_click" })
  })
  test("demo landing allowlist rejects Lite, private and token-bearing paths", () => {
    for (const landingPage of ["/register", "/fiyatlar", "/dashboard", "/w/secret", "//external.example", "/demo?token=secret"]) expect(sanitizeDemoAttribution({ landingPage })).toEqual({})
  })
  test("performance consent alone cannot collect or emit advertising", () => {
    const { storage, events } = browser(false)
    captureDemoAttribution()
    expect(storage.has(DEMO_ATTRIBUTION_KEY)).toBe(false)
    expect(getDemoAttribution()).toEqual({})
    expect(trackDemoAdvertisingConversion("00000000-0000-0000-0000-000000000000")).toBe(false)
    expect(events).toEqual([])
  })
  test("global off disables targeting and clears stored click IDs", () => {
    const { storage } = browser(true, "false")
    storage.set(DEMO_ATTRIBUTION_KEY, '{"gclid":"old-click"}')
    captureDemoAttribution()
    expect(storage.has(DEMO_ATTRIBUTION_KEY)).toBe(false)
    expect(getDemoAttribution()).toEqual({})
  })
  test("first attribution survives later navigation and never uses Lite storage", () => {
    const { storage } = browser(true)
    captureDemoAttribution()
    window.location.search = "?utm_source=meta&fbclid=second-click"
    captureDemoAttribution()
    expect(getDemoAttribution()).toEqual({ campaignSource: "google", gclid: "test-click", landingPage: "/demo" })
    expect(storage.has("bakimx:marketing-attribution")).toBe(false)
  })
  test("revocation removes click IDs and stops events", () => {
    const { storage } = browser(true)
    captureDemoAttribution()
    storage.delete(COOKIE_CONSENT_STORAGE_KEY)
    captureDemoAttribution()
    expect(storage.has(DEMO_ATTRIBUTION_KEY)).toBe(false)
    expect(trackDemoAdvertisingConversion("00000000-0000-0000-0000-000000000000")).toBe(false)
  })
  test("only opaque event ID is emitted with targeting consent", () => {
    const { events } = browser(true)
    expect(trackDemoAdvertisingConversion("contact@example.com")).toBe(false)
    expect(trackDemoAdvertisingConversion("00000000-0000-0000-0000-000000000000")).toBe(true)
    expect((events[0] as CustomEvent).detail).toEqual({ eventId: "00000000-0000-0000-0000-000000000000" })
  })
})

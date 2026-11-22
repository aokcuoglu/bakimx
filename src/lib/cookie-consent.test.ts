import { expect, test } from "bun:test"
import {
  ACCEPT_ALL_PREFERENCES,
  COOKIE_CONSENT_VERSION,
  createConsentRecord,
  DEFAULT_COOKIE_PREFERENCES,
  hasPerformanceConsent,
  isCookieConsentLegalPath,
  isPublicCookieConsentPath,
  parseCookieConsent,
} from "./cookie-consent"

test("public marketing ve yasal path'lerde true döner", () => {
  for (const p of [
    "/",
    "/fiyatlar",
    "/demo",
    "/privacy",
    "/kvkk",
    "/acik-riza",
    "/status",
    "/login",
    "/register",
    "/karsilastir/defter-excel-oto-servis-programi",
  ]) {
    expect(isPublicCookieConsentPath(p)).toBe(true)
  }
})

test("uygulama / admin / token path'lerinde false döner", () => {
  for (const p of [
    "/dashboard",
    "/admin",
    "/orders/123",
    "/checkout",
    "/p/abc",
    "/s/xyz",
    "/w/CODE",
  ]) {
    expect(isPublicCookieConsentPath(p)).toBe(false)
  }
})

test("benzer ama farklı prefix'lerde false döner", () => {
  expect(isPublicCookieConsentPath("/demoxyz")).toBe(false)
  expect(isPublicCookieConsentPath("/privacyx")).toBe(false)
})

test("parseCookieConsent geçerli kaydı kabul eder", () => {
  const record = createConsentRecord(ACCEPT_ALL_PREFERENCES, "2026-09-13T12:00:00.000Z")
  expect(parseCookieConsent(record)).toEqual(record)
  expect(hasPerformanceConsent(record)).toBe(true)
})

test("parseCookieConsent bozuk veya eski sürümü reddeder", () => {
  expect(parseCookieConsent(null)).toBeNull()
  expect(parseCookieConsent({})).toBeNull()
  expect(
    parseCookieConsent({
      version: COOKIE_CONSENT_VERSION + 1,
      updatedAt: "2026-09-13T12:00:00.000Z",
      preferences: ACCEPT_ALL_PREFERENCES,
    }),
  ).toBeNull()
  expect(
    parseCookieConsent({
      version: COOKIE_CONSENT_VERSION,
      updatedAt: "2026-09-13T12:00:00.000Z",
      preferences: { ...ACCEPT_ALL_PREFERENCES, necessary: false },
    }),
  ).toBeNull()
})

test("varsayılan tercihler performans kapalıdır", () => {
  expect(DEFAULT_COOKIE_PREFERENCES.performance).toBe(false)
  expect(hasPerformanceConsent(createConsentRecord(DEFAULT_COOKIE_PREFERENCES))).toBe(false)
})

test("isCookieConsentLegalPath yalnız hukuki belge sayfalarını eşler", () => {
  for (const p of ["/privacy", "/kvkk", "/terms", "/acik-riza", "/privacy/x", "/terms/a/b"]) {
    expect(isCookieConsentLegalPath(p)).toBe(true)
  }
  for (const p of ["/", "/login", "/privacyx", "/kvkkx", "/fiyatlar", "/demo/terms"]) {
    expect(isCookieConsentLegalPath(p)).toBe(false)
  }
})

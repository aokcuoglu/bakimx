/**
 * Public-site cookie consent (KVKK / ePrivacy).
 *
 * Preference is stored in localStorage (first-party). Analytics scripts load
 * only after explicit performance consent — see MarketingAnalytics.
 */

export const COOKIE_CONSENT_STORAGE_KEY = "bakimx.cookie-consent"
export const COOKIE_CONSENT_VERSION = 1
export const COOKIE_PREFERENCES_EVENT = "bakimx:cookie-preferences"
export const COOKIE_CONSENT_CHANGED_EVENT = "bakimx:cookie-consent-changed"

export type CookieCategory = "necessary" | "performance" | "functional" | "targeting"

export type CookieConsentPreferences = {
  necessary: true
  performance: boolean
  functional: boolean
  targeting: boolean
}

export type CookieConsentRecord = {
  version: typeof COOKIE_CONSENT_VERSION
  updatedAt: string
  preferences: CookieConsentPreferences
}

const PUBLIC_COOKIE_PREFIXES = [
  "/fiyatlar",
  "/oto-servis-programi",
  "/dijital-arac-kabul",
  "/is-emri-programi",
  "/rehber",
  "/blog",
  "/demo",
  "/contact-us",
  "/satin-al",
  "/terms",
  "/privacy",
  "/kvkk",
  "/acik-riza",
  "/status",
  "/karsilastir",
  "/login",
  "/register",
  "/forgot-password",
] as const

export const DEFAULT_COOKIE_PREFERENCES: CookieConsentPreferences = {
  necessary: true,
  performance: false,
  functional: false,
  targeting: false,
}

export const ACCEPT_ALL_PREFERENCES: CookieConsentPreferences = {
  necessary: true,
  performance: true,
  functional: true,
  targeting: true,
}

export const COOKIE_CATEGORIES: ReadonlyArray<{
  id: CookieCategory
  title: string
  description: string
  locked?: boolean
}> = [
  {
    id: "necessary",
    title: "Zorunlu Çerezler",
    description:
      "Oturum, güvenlik ve temel site işlevleri için gereklidir. Bunlar olmadan platform çalışmaz.",
    locked: true,
  },
  {
    id: "performance",
    title: "Performans Çerezleri",
    description:
      "Site kullanımını ölçmemize ve deneyimi iyileştirmemize yardımcı olur (ör. Google Analytics).",
  },
  {
    id: "functional",
    title: "İşlevsel Çerezler",
    description:
      "Arayüz tercihlerinizi ve yardımcı özelliklerin durumunu hatırlamak için kullanılır.",
  },
  {
    id: "targeting",
    title: "Hedefleme Çerezleri",
    description:
      "Etkinleştirildiğinde reklam tıklamalarını ve demo talebi dönüşümlerini ölçmek için kullanılır. Demo formundaki iletişim bilgileriniz reklam sağlayıcılarına gönderilmez.",
  },
]

export function isPublicCookieConsentPath(pathname: string): boolean {
  if (pathname === "/") return true
  return PUBLIC_COOKIE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function createConsentRecord(
  preferences: CookieConsentPreferences,
  updatedAt = new Date().toISOString(),
): CookieConsentRecord {
  return {
    version: COOKIE_CONSENT_VERSION,
    updatedAt,
    preferences: {
      necessary: true,
      performance: Boolean(preferences.performance),
      functional: Boolean(preferences.functional),
      targeting: Boolean(preferences.targeting),
    },
  }
}

export function parseCookieConsent(raw: unknown): CookieConsentRecord | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const data = raw as Record<string, unknown>
  if (data.version !== COOKIE_CONSENT_VERSION) return null
  if (typeof data.updatedAt !== "string" || !data.updatedAt) return null
  const prefs = data.preferences
  if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) return null
  const p = prefs as Record<string, unknown>
  if (p.necessary !== true) return null
  if (typeof p.performance !== "boolean") return null
  if (typeof p.functional !== "boolean") return null
  if (typeof p.targeting !== "boolean") return null
  return createConsentRecord(
    {
      necessary: true,
      performance: p.performance,
      functional: p.functional,
      targeting: p.targeting,
    },
    data.updatedAt,
  )
}

export function readCookieConsent(): CookieConsentRecord | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
    if (!raw) return null
    return parseCookieConsent(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeCookieConsent(preferences: CookieConsentPreferences): CookieConsentRecord {
  const record = createConsentRecord(preferences)
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record))
    } catch {
      /* Storage may be blocked; still notify listeners in-memory. */
    }
    window.dispatchEvent(
      new CustomEvent<CookieConsentRecord>(COOKIE_CONSENT_CHANGED_EVENT, { detail: record }),
    )
  }
  return record
}

export function openCookiePreferences(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(COOKIE_PREFERENCES_EVENT))
}

export function hasPerformanceConsent(record: CookieConsentRecord | null = readCookieConsent()): boolean {
  return record?.preferences.performance === true
}

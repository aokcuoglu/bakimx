"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { Cookie, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  ACCEPT_ALL_PREFERENCES,
  COOKIE_CATEGORIES,
  COOKIE_CONSENT_CHANGED_EVENT,
  COOKIE_CONSENT_STORAGE_KEY,
  COOKIE_PREFERENCES_EVENT,
  DEFAULT_COOKIE_PREFERENCES,
  type CookieConsentPreferences,
  isPublicCookieConsentPath,
  parseCookieConsent,
  readCookieConsent,
  writeCookieConsent,
} from "@/lib/cookie-consent"
import { cn } from "@/lib/utils"

type DraftPreferences = Omit<CookieConsentPreferences, "necessary"> & { necessary: true }

function toDraft(prefs: CookieConsentPreferences): DraftPreferences {
  return {
    necessary: true,
    performance: prefs.performance,
    functional: prefs.functional,
    targeting: prefs.targeting,
  }
}

const noopSubscribe = () => () => {}

function subscribeConsent(onStoreChange: () => void) {
  window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

/** Stable snapshot for useSyncExternalStore — must not allocate a new object each read. */
function getConsentSnapshot(): string | null {
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
  } catch {
    return null
  }
}

export function CookieConsent() {
  const pathname = usePathname()
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const consentRaw = useSyncExternalStore(subscribeConsent, getConsentSnapshot, () => null)
  const consent = useMemo(() => {
    if (!consentRaw) return null
    try {
      return parseCookieConsent(JSON.parse(consentRaw))
    } catch {
      return null
    }
  }, [consentRaw])

  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [draft, setDraft] = useState<DraftPreferences>(toDraft(DEFAULT_COOKIE_PREFERENCES))

  useEffect(() => {
    const onOpenPreferences = () => {
      const current = readCookieConsent()
      setDraft(toDraft(current?.preferences ?? DEFAULT_COOKIE_PREFERENCES))
      setPreferencesOpen(true)
    }
    window.addEventListener(COOKIE_PREFERENCES_EVENT, onOpenPreferences)
    return () => window.removeEventListener(COOKIE_PREFERENCES_EVENT, onOpenPreferences)
  }, [])

  const save = useCallback((preferences: CookieConsentPreferences) => {
    writeCookieConsent(preferences)
    setPreferencesOpen(false)
    setDraft(toDraft(preferences))
  }, [])

  const openPreferences = useCallback(() => {
    setDraft(toDraft(consent?.preferences ?? DEFAULT_COOKIE_PREFERENCES))
    setPreferencesOpen(true)
  }, [consent])

  if (!hydrated || !isPublicCookieConsentPath(pathname)) return null

  const showBanner = !consent && !preferencesOpen

  return (
    <>
      {showBanner ? (
        <div
          role="dialog"
          aria-labelledby="cookie-consent-title"
          aria-describedby="cookie-consent-desc"
          data-slot="cookie-consent-banner"
          className={cn(
            // Bottom-left, clear of the site-assistant FAB (bottom-right).
            "fixed bottom-20 left-4 z-50 w-[min(100%-2rem,20rem)] sm:bottom-5 sm:left-5",
            "rounded-xl border border-border bg-card p-4 text-card-foreground shadow-md",
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"
              aria-hidden
            >
              <Cookie className="size-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="space-y-1.5">
                <h2
                  id="cookie-consent-title"
                  className="text-sm font-semibold tracking-tight text-foreground"
                >
                  Çerez kullanıyoruz
                </h2>
                <p
                  id="cookie-consent-desc"
                  className="text-xs leading-relaxed text-muted-foreground"
                >
                  Deneyimi iyileştirmek için çerez kullanırız. Ayrıntılar için{" "}
                  <Link
                    href="/privacy#cerezler"
                    className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                  >
                    Gizlilik Politikası
                  </Link>
                  .
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={openPreferences}
                  className="h-auto p-0 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Tercihler
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1"
                  onClick={() => save(DEFAULT_COOKIE_PREFERENCES)}
                >
                  Reddet
                </Button>
                <Button
                  type="button"
                  variant="navy"
                  size="sm"
                  className="h-8 flex-1"
                  onClick={() => save(ACCEPT_ALL_PREFERENCES)}
                >
                  Kabul et
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <DialogContent
          className="gap-5 sm:max-w-md"
          showCloseButton
          data-slot="cookie-preferences-dialog"
        >
          <DialogHeader className="gap-1.5 border-b border-border pb-4">
            <DialogTitle className="text-base">Çerez tercihleri</DialogTitle>
            <DialogDescription className="text-sm">
              Kategorileri ayrı ayrı yönetebilirsiniz. Ayrıntılar:{" "}
              <Link
                href="/privacy#cerezler"
                className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
              >
                Gizlilik Politikası
              </Link>
              .
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2">
            {COOKIE_CATEGORIES.map((category) => {
              const checked = draft[category.id]
              const locked = Boolean(category.locked)
              return (
                <li
                  key={category.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <Label
                        htmlFor={`cookie-cat-${category.id}`}
                        className="text-sm font-medium text-foreground"
                      >
                        {category.title}
                      </Label>
                      {locked ? (
                        <Lock className="size-3 text-muted-foreground" aria-hidden />
                      ) : null}
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                  <Switch
                    id={`cookie-cat-${category.id}`}
                    size="sm"
                    checked={checked}
                    disabled={locked}
                    onCheckedChange={(next) => {
                      if (locked) return
                      setDraft((prev) => ({ ...prev, [category.id]: next }))
                    }}
                    aria-label={category.title}
                  />
                </li>
              )
            })}
          </ul>

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => save(DEFAULT_COOKIE_PREFERENCES)}
            >
              Tümünü reddet
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => save(draft)}>
                Kaydet
              </Button>
              <Button
                type="button"
                variant="navy"
                size="sm"
                onClick={() => save(ACCEPT_ALL_PREFERENCES)}
              >
                Tümünü kabul et
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

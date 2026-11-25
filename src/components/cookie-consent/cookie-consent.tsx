"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { Cookie, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
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
  isCookieConsentLegalPath,
  isPublicCookieConsentPath,
  parseCookieConsent,
  readCookieConsent,
  writeCookieConsent,
} from "@/lib/cookie-consent"

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

  const contentRef = useRef<HTMLDivElement | null>(null)
  const [barHeight, setBarHeight] = useState(0)
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

  const showBanner = hydrated && !consent && !preferencesOpen
  const isLegal = isCookieConsentLegalPath(pathname)
  const needsSpacer = showBanner && isLegal

  // Non-modal bar on legal pages overlays the page end; reserve its height.
  useEffect(() => {
    if (!needsSpacer) return
    let observer: ResizeObserver | undefined
    let frame = requestAnimationFrame(function attach() {
      const node = contentRef.current
      if (!node) {
        frame = requestAnimationFrame(attach)
        return
      }
      observer = new ResizeObserver(() => setBarHeight(node.offsetHeight))
      observer.observe(node)
    })
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      setBarHeight(0)
    }
  }, [needsSpacer])

  if (!hydrated || !isPublicCookieConsentPath(pathname)) return null

  return (
    <>
      {needsSpacer ? <div aria-hidden style={{ height: barHeight }} /> : null}
      <Sheet
        open={showBanner}
        // The banner is derived from stored consent; close requests are ignored.
        onOpenChange={() => {}}
        modal={!isLegal}
      >
        <SheetContent
          side="bottom"
          ref={contentRef}
          showCloseButton={false}
          overlayClassName="bg-foreground/20 backdrop-blur-none supports-backdrop-filter:backdrop-blur-none"
          data-slot="cookie-consent-banner"
          className="gap-0 p-0 pb-[env(safe-area-inset-bottom)] outline-none focus:outline-none focus-visible:outline-none"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => {
            // No button gets a ring on open; modal keeps focus inside the bar.
            event.preventDefault()
            if (!isLegal) contentRef.current?.focus()
          }}
        >
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground"
                aria-hidden
              >
                <Cookie className="size-4" />
              </div>
              <div className="min-w-0 space-y-1">
                <SheetTitle className="text-sm font-semibold tracking-tight">
                  Çerez kullanıyoruz
                </SheetTitle>
                <SheetDescription className="text-sm leading-relaxed sm:text-xs">
                  Deneyimi iyileştirmek için çerez kullanırız. Ayrıntılar için{" "}
                  <Link
                    href="/privacy#cerezler"
                    className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                  >
                    Gizlilik Politikası
                  </Link>
                  .
                </SheetDescription>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-nowrap">
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => save(DEFAULT_COOKIE_PREFERENCES)}
              >
                Reddet
              </Button>
              <Button
                type="button"
                variant="navy"
                className="flex-1 sm:flex-none"
                onClick={() => save(ACCEPT_ALL_PREFERENCES)}
              >
                Kabul et
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={openPreferences}
                className="w-full text-muted-foreground-strong underline hover:text-foreground sm:w-auto"
              >
                Tercihler
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

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

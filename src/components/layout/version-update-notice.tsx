"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { InfoIcon, XIcon } from "lucide-react"
import { isOutdatedBuild } from "@/lib/app-version"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { BrandSpinner } from "@/components/shared/brand-spinner"

/**
 * "Yeni sürüm var — yenile" bildirimi (engellemeyen).
 *
 * `loadedSignature` bu belgeyi RENDER EDEN sunucunun build imzasıdır; yani açık
 * sekmenin elindeki `/_next/static/...` chunk'larının ait olduğu build. Sekme
 * odaklandığında ve periyodik olarak `/api/version` sorulur, imza değiştiyse
 * kullanıcıya shadcn Alert gösterilir.
 *
 * Kasıtlı olarak YAPILMAYANLAR: modal yok, otomatik reload yok, geri sayım yok.
 * Yarım kalmış bir iş emri/teklif formu varken zorla yenileme veri kaybettirir —
 * yenileme anını kullanıcı seçer. Bildirim bir kez gösterilir; kapatılırsa geri
 * gelmez (chunk hatası olursa `chunk-error.ts` ağı hâlâ altta duruyor).
 *
 * Bilinen pencere: ECS yayılımı sırasında eski ve yeni task'lar birlikte çalışır;
 * yeni build'i yüklemiş bir sekme eski bir task'a denk gelirse imza farklı görünür
 * ve bildirim gereksiz yere çıkabilir. Sonucu zararsız (bir yenileme) ve pencere
 * dakikalarla sınırlı olduğu için sticky-session karmaşıklığına girilmedi.
 */

const POLL_INTERVAL_MS = 10 * 60 * 1000
const MIN_CHECK_GAP_MS = 60 * 1000
/** Iris örtüsü görülsün diye yenilemeden önceki bekleme (hareket azaltmada kısaltılır). */
const RELOAD_HOLD_MS = 780
const RELOAD_HOLD_REDUCED_MS = 80

export function VersionUpdateNotice({ loadedSignature }: { loadedSignature: string }) {
  const lastCheckedAt = useRef(0)
  const notified = useRef(false)
  const [visible, setVisible] = useState(false)
  const [reloading, setReloading] = useState(false)

  function reloadWithOverlay() {
    if (reloading) return
    setReloading(true)
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    window.setTimeout(
      () => {
        window.location.reload()
      },
      reduced ? RELOAD_HOLD_REDUCED_MS : RELOAD_HOLD_MS,
    )
  }

  useEffect(() => {
    if (!loadedSignature) return
    let cancelled = false

    async function check() {
      if (cancelled || notified.current) return
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      const now = Date.now()
      if (now - lastCheckedAt.current < MIN_CHECK_GAP_MS) return
      lastCheckedAt.current = now

      let data: unknown
      try {
        const res = await fetch("/api/version", { cache: "no-store" })
        if (!res.ok) return
        data = await res.json()
      } catch {
        return
      }
      if (cancelled || notified.current) return
      if (!isOutdatedBuild(loadedSignature, data)) return

      notified.current = true
      setVisible(true)
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") void check()
    }

    const timer = window.setInterval(() => void check(), POLL_INTERVAL_MS)
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [loadedSignature])

  if (!visible && !reloading) return null

  return (
    <>
      {visible && !reloading && (
        <div className="pointer-events-none fixed inset-x-3 bottom-28 z-50 flex justify-end sm:inset-x-auto sm:right-4 sm:bottom-4">
          <Alert className="pointer-events-auto w-full max-w-md shadow-sm has-data-[slot=alert-action]:pr-28">
            <InfoIcon />
            <AlertTitle>Yeni sürüm kullanılabilir</AlertTitle>
            <AlertDescription>
              Sayfayı yenileyerek güncel sürüme geçebilirsiniz. Lütfen açık formlarınızı öncesinde
              kaydedin.
            </AlertDescription>
            <AlertAction className="flex items-start gap-1">
              <Button size="sm" onClick={reloadWithOverlay}>
                Şimdi Yenile
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Kapat"
                onClick={() => setVisible(false)}
              >
                <XIcon />
              </Button>
            </AlertAction>
          </Alert>
        </div>
      )}
      {reloading && typeof document !== "undefined"
        ? createPortal(
            <div
              className="version-reload-iris fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
              role="status"
              aria-live="assertive"
              aria-busy="true"
            >
              <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-muted">
                <div className="version-reload-bar h-full w-1/3 bg-brand" />
              </div>
              <div className="relative flex size-40 items-center justify-center">
                <span
                  className="version-reload-ripple pointer-events-none absolute inset-0 rounded-full border-2 border-brand/30"
                  aria-hidden="true"
                />
                <span
                  className="version-reload-ripple pointer-events-none absolute inset-3 rounded-full border-2 border-navy/25 dark:border-brand/25"
                  style={{ animationDelay: "0.35s" }}
                  aria-hidden="true"
                />
                <BrandSpinner size={72} label="Yeni sürüm yükleniyor…" />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

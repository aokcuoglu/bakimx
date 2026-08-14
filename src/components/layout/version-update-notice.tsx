"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { isOutdatedBuild } from "@/lib/app-version"

/**
 * "Yeni sürüm var — yenile" bildirimi (engellemeyen).
 *
 * `loadedSignature` bu belgeyi RENDER EDEN sunucunun build imzasıdır; yani açık
 * sekmenin elindeki `/_next/static/...` chunk'larının ait olduğu build. Sekme
 * odaklandığında ve periyodik olarak `/api/version` sorulur, imza değiştiyse
 * kullanıcıya sonner toast'u gösterilir.
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

// Yoklama aralığı — deploy dakikalar sürer, sık sorgunun faydası yok.
const POLL_INTERVAL_MS = 10 * 60 * 1000
// Odak/görünürlük olayları arka arkaya tetiklenebilir; aynı saniyede iki istek atma.
const MIN_CHECK_GAP_MS = 60 * 1000
const TOAST_ID = "app-version-update"

export function VersionUpdateNotice({ loadedSignature }: { loadedSignature: string }) {
  const lastCheckedAt = useRef(0)
  const notified = useRef(false)

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
        // Çevrimdışı / geçici ağ hatası: sessizce geç, bir sonraki turda yeniden dene.
        return
      }
      if (cancelled || notified.current) return
      if (!isOutdatedBuild(loadedSignature, data)) return

      notified.current = true
      toast.info("Yeni sürüm kullanılabilir", {
        id: TOAST_ID,
        description: "Sayfayı yenileyerek güncel sürüme geçebilirsiniz. Lütfen açık formlarınızı öncesinde kaydedin.",
        duration: Infinity,
        closeButton: true,
        action: {
          label: "Şimdi Yenile",
          onClick: () => window.location.reload(),
        },
      })
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

  return null
}

"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

const POLL_INTERVAL_MS = 5000

/**
 * İş emri detay sayfasını senkronize tutar. Periyodik olarak `router.refresh()`
 * çağırarak aynı iş emrini başka bir browser/sekmede düzenleyen kullanıcının
 * değişikliklerini çeker (parça ekleme, durum değişimi, fotoğraf vb. — tüm sayfa).
 *
 * - Sadece sekme görünür VE tarayıcı online iken poll eder (arka plan/çevrimdışı yük yok).
 * - Kullanıcı bir input/textarea/select/dialog/listbox içindeyken refresh'i atlar
 *   (form state'i ve modal/Select dropdown akışı bozulmasın). react-hook-form
 *   defaultValues değişse bile form state korunur, yani bu önlem ekstra güvenlik
 *   için. Açık Dialog/Sheet/AlertDialog (base-ui `data-open`) ve Select popup
 *   (`role='listbox'`) tespit edilirse refresh atlanır.
 * - Sekmeye geri odaklanınca ve online olunca anında bir refresh tetikler (gecikmeyi azaltır).
 * - Unmount'ta interval + event listener'ları temizler.
 *
 * @param intervalMs Poll aralığı (ms). Default 5000.
 */
export function useOrderSync(intervalMs: number = POLL_INTERVAL_MS) {
  const router = useRouter()
  const routerRef = useRef(router)

  useEffect(() => {
    routerRef.current = router
  }, [router])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    const isInteracting = () => {
      if (typeof document === "undefined") return false
      const el = document.activeElement as HTMLElement | null
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.getAttribute("contenteditable") === "true")
      ) {
        return true
      }
      // Açık Dialog/Sheet/AlertDialog varsa refresh'i atla (base-ui data-open).
      // Not: base-ui Radix DEĞİLDİR — `data-state="open"` yerine `data-open`
      // kullanır (Dialog/Sheet/AlertDialog popup + backdrop).
      if (
        document.querySelector(
          "[role='dialog'][data-open], [role='alertdialog'][data-open], [role='presentation'][data-open]"
        )
      ) {
        return true
      }
      // Açık Select dropdown popup'ı (base-ui role='listbox' + data-open) varsa
      // refresh'i atla — popup kapanmasın, scroll/odak kaybı olmasın.
      if (document.querySelector("[role='listbox'][data-open]")) {
        return true
      }
      return false
    }

    const tick = () => {
      if (document.hidden) return
      if (typeof navigator !== "undefined" && navigator.onLine === false) return
      if (isInteracting()) return
      routerRef.current.refresh()
    }

    const start = () => {
      if (timer) return
      timer = setInterval(tick, intervalMs)
    }
    const stop = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }

    const onVisibility = () => {
      if (document.hidden) stop()
      else {
        tick()
        start()
      }
    }
    const onOnline = () => {
      tick()
      start()
    }
    const onOffline = () => stop()

    if (!document.hidden) start()

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)

    return () => {
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [intervalMs])
}
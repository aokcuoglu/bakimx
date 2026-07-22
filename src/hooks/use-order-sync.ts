"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

const POLL_INTERVAL_MS = 5000

/**
 * İş emri detay sayfasını senkronize tutar. Periyodik olarak sunucudaki hafif
 * `/api/orders/[id]/version` ucunu yoklar ve dönen "sürüm" token'ı değiştiğinde
 * `router.refresh()` çağırarak aynı iş emrini başka bir browser/sekmede
 * düzenleyen kullanıcının değişikliklerini çeker (parça ekleme, durum değişimi,
 * fotoğraf vb. — tüm sayfa).
 *
 * Neden koşullu: `router.refresh()` App Router'da tüm RSC ağacını (page.tsx'teki
 * onlarca Prisma sorgusu + render) yeniden çeker. Idle sekmede bunu her 5 sn'de
 * körlemesine yapmak yerine önce ucuz bir aggregate ile "bir şey değişti mi?"
 * diye bakıyoruz; değişmediyse hiçbir ağ/DB yükü oluşmaz.
 *
 * - Sadece sekme görünür VE tarayıcı online iken poll eder (arka plan/çevrimdışı yük yok).
 * - Kullanıcı bir input/textarea/select/dialog/listbox içindeyken yoklamayı atlar
 *   (form state'i ve modal/Select dropdown akışı bozulmasın). react-hook-form
 *   defaultValues değişse bile form state korunur, yani bu önlem ekstra güvenlik
 *   için. Açık Dialog/Sheet/AlertDialog (base-ui `data-open`) ve Select popup
 *   (`role='listbox'`) tespit edilirse yoklama atlanır.
 * - Sekmeye geri odaklanınca ve online olunca anında bir yoklama tetikler (gecikmeyi azaltır).
 * - Unmount'ta interval + event listener'ları temizler.
 *
 * @param orderId Yoklanacak iş emri kimliği. Boş/undefined ise senkron devre dışıdır.
 * @param intervalMs Poll aralığı (ms). Default 5000.
 */
export function useOrderSync(orderId: string | undefined, intervalMs: number = POLL_INTERVAL_MS) {
  const router = useRouter()
  const routerRef = useRef(router)
  // İlk başarılı yoklamada sayfa zaten taze (mount'ta RSC geldi); baz sürümü
  // kaydeder ama refresh ETMEYİZ. Sonraki değişimlerde refresh tetiklenir.
  const lastVersionRef = useRef<string | null>(null)
  // Aynı anda birden çok istek üst üste binmesin (yavaş yanıt + kısa interval).
  const inFlightRef = useRef(false)

  useEffect(() => {
    routerRef.current = router
  }, [router])

  useEffect(() => {
    if (!orderId) return

    let timer: ReturnType<typeof setInterval> | null = null
    let cancelled = false

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
      // Açık Dialog/Sheet/AlertDialog varsa yoklamayı atla (base-ui data-open).
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
      // yoklamayı atla — popup kapanmasın, scroll/odak kaybı olmasın.
      if (document.querySelector("[role='listbox'][data-open]")) {
        return true
      }
      return false
    }

    const tick = async () => {
      if (document.hidden) return
      if (typeof navigator !== "undefined" && navigator.onLine === false) return
      if (isInteracting()) return
      if (inFlightRef.current) return

      inFlightRef.current = true
      try {
        const res = await fetch(`/api/orders/${orderId}/version`, {
          cache: "no-store",
          headers: { "x-order-sync": "1" },
        })
        if (!res.ok) return
        const data = (await res.json()) as { version?: string }
        const version = data?.version
        if (cancelled || typeof version !== "string") return

        if (lastVersionRef.current === null) {
          // İlk yoklama: bazı kaydet, refresh etme (sayfa zaten taze).
          lastVersionRef.current = version
          return
        }
        if (version !== lastVersionRef.current) {
          lastVersionRef.current = version
          // Refresh sonrası kullanıcı yeni içeriği görür; sürüm zaten güncellendi.
          routerRef.current.refresh()
        }
      } catch {
        // Ağ hatası — sessizce geç, sonraki tick'te tekrar denenir.
      } finally {
        inFlightRef.current = false
      }
    }

    const start = () => {
      if (timer) return
      timer = setInterval(() => void tick(), intervalMs)
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
        void tick()
        start()
      }
    }
    const onOnline = () => {
      void tick()
      start()
    }
    const onOffline = () => stop()

    if (!document.hidden) start()

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)

    return () => {
      cancelled = true
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [orderId, intervalMs])
}

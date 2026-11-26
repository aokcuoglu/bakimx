"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { cn } from "@/lib/utils"

/**
 * İçerik bağlandıktan sonra sarmalayıcıdan kabarcıklanan olay. Sayfa derin
 * bağlantı hedefini yeniden hizalamak için dinler (use-order-section-scroll).
 */
export const DEFERRED_MOUNT_EVENT = "bakimx:deferred-mount"

/**
 * Ağır bir bölümü (ör. 3B hasar haritası) görünür alana yaklaşınca bağlar ve
 * sonra bağlı tutar (#911). Tek sayfalık araç kabulü detayında tüm bölümler
 * birlikte çizildiği için, sekme arkasında beklerken hiç yüklenmeyen içerik
 * sayfa açılışını ağırlaştırmasın.
 *
 * Yer tutucu yüklenmiş içeriğin yüksekliğine yakın olmalı (`placeholderClassName`):
 * değişim anında üstteki bir derin bağlantı hedefi kaymasın. Bağlanınca
 * sarmalayıcı `display:contents` olur (düzene katılmaz) ve `DEFERRED_MOUNT_EVENT`
 * yayar.
 */
export function DeferUntilVisible({
  children,
  rootMargin = "600px",
  label = "Yükleniyor",
  placeholderClassName = "min-h-[320px] sm:min-h-[400px]",
}: {
  children: ReactNode
  /** Görünür alana bu kadar yaklaşınca bağla. */
  rootMargin?: string
  /** Yer tutucudaki yükleme metni (ekran okuyucu). */
  label?: string
  /** Yer tutucunun yüksekliği; yüklenmiş içeriğe yakın tutulur. */
  placeholderClassName?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (visible) {
      el.dispatchEvent(new Event(DEFERRED_MOUNT_EVENT, { bubbles: true }))
      return
    }
    // Gözlemci yoksa beklemeden bağla (yer tutucu kalıcı olmasın).
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(frame)
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        setVisible(true)
      },
      { rootMargin },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [visible, rootMargin])

  return (
    <div ref={ref} className={visible ? "contents" : cn("grid place-items-center", placeholderClassName)}>
      {visible ? children : <BrandSpinner size={40} label={label} />}
    </div>
  )
}

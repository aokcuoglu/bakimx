"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { BrandSpinner } from "@/components/shared/brand-spinner"

/**
 * Ağır bir bölümü (ör. 3B hasar haritası) görünür alana yaklaşınca bağlar ve
 * sonra bağlı tutar (#911). Tek sayfalık araç kabulü detayında tüm bölümler
 * birlikte çizildiği için, sekme arkasında beklerken hiç yüklenmeyen içerik
 * sayfa açılışını ağırlaştırmasın.
 *
 * Yer tutucu yaklaşık yüksekliği korur; bağlanınca kayma olursa sayfa
 * `?tab=` hedefini yeniden hizalar (work-order-detail).
 */
export function DeferUntilVisible({
  children,
  rootMargin = "600px",
  label = "Yükleniyor",
}: {
  children: ReactNode
  /** Görünür alana bu kadar yaklaşınca bağla. */
  rootMargin?: string
  /** Yer tutucudaki yükleme metni (ekran okuyucu). */
  label?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (visible) return
    const el = ref.current
    if (!el) return
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

  if (visible) return <>{children}</>
  return (
    <div ref={ref} className="grid min-h-[320px] place-items-center sm:min-h-[400px]">
      <BrandSpinner size={40} label={label} />
    </div>
  )
}

"use client"

import { useEffect, useState, type RefObject } from "react"
import {
  ORDER_SECTIONS,
  isOrderSectionId,
  pickActiveSection,
  type OrderSectionId,
} from "@/lib/orders/detail-sections"

/**
 * Araç kabulü detayında görünürdeki bölüm (#911): bölüm çiplerinin etkin
 * olanı. `root` altındaki `[data-section]` blokları okunur; aynı bölümü
 * taşıyan birden çok blokta (telefonda ray kartları bölümün içine girer) en
 * üstteki sayılır. Okuma çizgisi blokların `scroll-margin-top`u (üst bar +
 * çip şeridi), yani çipe dokunup gidilen bölüm hemen etkin görünür.
 *
 * Tetik pasif `scroll` + rAF, IntersectionObserver değil: IO yalnız eşik
 * geçişinde haber verir — görünür alandan uzun bir bölümün üst kenarı okuma
 * çizgisini geçerken hiçbir eşik geçilmeyebilir, sayfa sonunda da kısa son
 * bölüm çizgiye hiç ulaşmaz. Kare başına birkaç `getBoundingClientRect`
 * okunur, değer değişmedikçe yeniden çizim yok.
 */
export function useSectionSpy(rootRef: RefObject<HTMLElement | null>): OrderSectionId {
  const [active, setActive] = useState<OrderSectionId>(ORDER_SECTIONS[0].id)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let frame = 0

    const measure = () => {
      frame = 0
      const tops = new Map<OrderSectionId, number>()
      let offset: number | null = null
      for (const block of root.querySelectorAll<HTMLElement>("[data-section]")) {
        const id = block.dataset.section
        // display:none (ör. iki kolonda gizlenen kart) kutu üretmez, sayılmaz.
        if (!isOrderSectionId(id) || block.getClientRects().length === 0) continue
        offset ??= Number.parseFloat(getComputedStyle(block).scrollMarginTop) || 0
        const top = block.getBoundingClientRect().top
        const current = tops.get(id)
        if (current === undefined || top < current) tops.set(id, top)
      }
      const doc = document.documentElement
      const atEnd = window.scrollY > 0 && window.innerHeight + window.scrollY >= doc.scrollHeight - 2
      setActive(pickActiveSection([...tops].map(([id, top]) => ({ id, top })), offset ?? 0, atEnd))
    }

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    schedule()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [rootRef])

  return active
}

"use client"

import { useEffect, useState, type RefObject } from "react"
import {
  ORDER_SECTIONS,
  isOrderSectionId,
  pickActiveSection,
  type OrderSectionId,
} from "@/lib/orders/detail-sections"

// Sayfayı kaydıran tuşlar: yalnız bunlar dokunulan çipin tutulmasını bırakır
// (Tab ile çipler arasında gezinmek etkin çipi değiştirmemeli).
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "])

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
 * okunur, değer değişmedikçe yeniden çizim yok. Çip şeridi kutu üretmiyorsa
 * (iki kolon, `display:none`) hiç ölçülmez.
 *
 * `hold(id)`: dokunulan çip, kullanıcı sayfayı kendisi kaydırana kadar etkin
 * kalır. Sayfa sonundaki kısa bölümler (ör. Lite'ta Teknisyen yükseltme kutusu
 * Geçmiş'in üstünde) okuma çizgisine ulaşamadığından konum tek başına yanlış
 * çipi yakardı.
 */
export function useSectionSpy(
  rootRef: RefObject<HTMLElement | null>,
  navRef: RefObject<HTMLElement | null>,
): { active: OrderSectionId; hold: (id: OrderSectionId) => void } {
  const [spied, setSpied] = useState<OrderSectionId>(ORDER_SECTIONS[0].id)
  const [held, setHeld] = useState<OrderSectionId | null>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let frame = 0

    const measure = () => {
      frame = 0
      const nav = navRef.current
      if (nav && nav.getClientRects().length === 0) return
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
      setSpied(pickActiveSection([...tops].map(([id, top]) => ({ id, top })), offset ?? 0, atEnd))
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
  }, [rootRef, navRef])

  // Tutulan çip: dokunuştan SONRA bağlanır (dokunuşun kendi pointerdown'u geçmiştir);
  // kullanıcının bir sonraki kaydırma girdisi bırakır.
  useEffect(() => {
    if (!held) return
    const release = (event: Event) => {
      if (event instanceof KeyboardEvent && !SCROLL_KEYS.has(event.key)) return
      setHeld(null)
    }
    const inputs = ["wheel", "touchstart", "pointerdown", "keydown"] as const
    for (const type of inputs) window.addEventListener(type, release, { passive: true })
    return () => {
      for (const type of inputs) window.removeEventListener(type, release)
    }
  }, [held])

  return { active: held ?? spied, hold: setHeld }
}

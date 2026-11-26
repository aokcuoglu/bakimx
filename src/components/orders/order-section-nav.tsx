"use client"

import { useEffect, useRef, type RefObject } from "react"
import { detail } from "@/components/orders/order-detail-surface"
import { useSectionSpy } from "@/hooks/use-section-spy"
import { ORDER_SECTIONS, type OrderSectionId } from "@/lib/orders/detail-sections"

/**
 * Araç kabulü detayının bölüm çipleri (#911): telefon ve dar içerikte üst
 * barın altında yapışkan, iki kolonda gizli (ray bağlamı zaten gösterir).
 *
 * Sekme değil sayfa içi bağlantı listesi: her çip `<a href="#bölüm">`, etkin
 * olan `aria-current="location"`. Dokununca bölüme kaydırılır ve odak bölüme
 * geçer (`onNavigate`); kaydırdıkça etkin çip `useSectionSpy` ile güncellenir.
 * Kilitli bölümlerde kilit simgesi yok: bölümün kendisi yükseltme kutusunu
 * gösterir.
 */
export function OrderSectionNav({
  rootRef,
  onNavigate,
}: {
  /** Bölüm bloklarını (`[data-section]`) içeren sayfa kökü. */
  rootRef: RefObject<HTMLElement | null>
  onNavigate: (id: OrderSectionId) => void
}) {
  const active = useSectionSpy(rootRef)
  const listRef = useRef<HTMLElement>(null)

  // Etkin çip taşan şeridin dışında kalmasın (#848): yalnız şeridi yatay kaydır.
  // scrollIntoView sayfayı dikey de kaydırır ve bölüm kaydırmasıyla çakışır.
  useEffect(() => {
    const list = listRef.current
    const chip = list?.querySelector<HTMLElement>('[aria-current="location"]')
    if (!list || !chip) return
    const l = list.getBoundingClientRect()
    const t = chip.getBoundingClientRect()
    const pad = 16
    if (t.left < l.left + pad) {
      list.scrollTo({ left: list.scrollLeft + (t.left - l.left) - pad, behavior: "smooth" })
    } else if (t.right > l.right - pad) {
      list.scrollTo({ left: list.scrollLeft + (t.right - l.right) + pad, behavior: "smooth" })
    }
  }, [active])

  return (
    <nav ref={listRef} aria-label="Bölümler" className={detail.chips}>
      <ul className={detail.chipList}>
        {ORDER_SECTIONS.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className={detail.chip}
              aria-current={section.id === active ? "location" : undefined}
              onClick={(event) => {
                event.preventDefault()
                onNavigate(section.id)
              }}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

"use client"

import { useEffect, type RefObject } from "react"
import {
  isOrderSectionId,
  sectionForLegacyTab,
  sectionUrl,
  type OrderSectionId,
} from "@/lib/orders/detail-sections"

/**
 * Bölümün kaydırma hedefi: aynı `data-section`ı taşıyan bloklardan görünür
 * olan en üstteki. Telefonda ray `display:contents` olduğu için ray kartları
 * akışın parçasıdır (Ödeme bölümü fiyat kartıyla başlar); iki kolonda yapışkan
 * raydaki kartlar hedef olmaz, ana kolondaki blok seçilir.
 */
function findSectionTarget(root: HTMLElement, rail: HTMLElement | null, id: OrderSectionId): HTMLElement | null {
  const railIsColumn = rail ? getComputedStyle(rail).display !== "contents" : false
  let target: HTMLElement | null = null
  let targetTop = Number.POSITIVE_INFINITY
  for (const block of root.querySelectorAll<HTMLElement>(`[data-section="${id}"]`)) {
    if (railIsColumn && rail?.contains(block)) continue
    if (block.getClientRects().length === 0) continue
    const top = block.getBoundingClientRect().top
    if (top < targetTop) {
      target = block
      targetTop = top
    }
  }
  return target
}

/** Hareket azaltma tercihinde anında, değilse yumuşak kaydırma. */
export function sectionScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
}

/**
 * Bölüme kaydırır, odağı bölüme taşır (klavye ve ekran okuyucu oradan devam
 * eder) ve adresi `#bölüm` yapar. `history.replaceState`: sunucuya gidilmez,
 * geçmişe kayıt eklenmez; `?tab=` ve `?edit=` düşer.
 */
function goToSection(
  root: HTMLElement,
  rail: HTMLElement | null,
  id: OrderSectionId,
  behavior: ScrollBehavior,
): void {
  const target = findSectionTarget(root, rail, id)
  if (!target) return
  target.scrollIntoView({ block: "start", behavior })
  target.focus({ preventScroll: true })
  window.history.replaceState(window.history.state, "", sectionUrl(window.location.href, id))
}

/**
 * Tek sayfalık araç kabulü detayının gezinmesi (#911). Döndürdüğü işlev
 * bölüme kaydırır; ayrıca:
 *
 * - Açılışta eski `?tab=` bağlantısını (liste, bildirim, uyarı) ya da `#bölüm`
 *   adresini o bölüme kaydırır. Üstteki eşzamansız içerik (küçük resimler,
 *   tembel bağlanan hasar haritası) yüklendikçe hedef aşağı kayar: kullanıcı
 *   kaydırmaya başlayana ya da 2 sn geçene kadar sayfa boyu değiştikçe yeniden
 *   hizalanır.
 * - İki kolonda yapışkan rayın yüksekliğini `--rail-h` olarak yazar; ray
 *   görünür alandan uzunsa CSS onu alt kenarı görünecek yerde yapıştırır.
 */
export function useOrderSectionScroll(
  pageRef: RefObject<HTMLElement | null>,
  railRef: RefObject<HTMLElement | null>,
): (id: OrderSectionId, behavior?: ScrollBehavior) => void {
  useEffect(() => {
    const root = pageRef.current
    if (!root) return
    const hash = window.location.hash.slice(1)
    const id =
      sectionForLegacyTab(new URLSearchParams(window.location.search).get("tab")) ??
      (isOrderSectionId(hash) ? hash : null)
    if (!id) return

    goToSection(root, railRef.current, id, "auto")
    if (typeof ResizeObserver === "undefined") return

    const realign = new ResizeObserver(() => {
      findSectionTarget(root, railRef.current, id)?.scrollIntoView({ block: "start" })
    })
    realign.observe(root)
    const inputs = ["wheel", "touchstart", "keydown", "pointerdown"] as const
    const stop = () => {
      realign.disconnect()
      window.clearTimeout(timer)
      for (const type of inputs) window.removeEventListener(type, stop)
    }
    const timer = window.setTimeout(stop, 2000)
    for (const type of inputs) window.addEventListener(type, stop, { passive: true })
    return stop
  }, [pageRef, railRef])

  useEffect(() => {
    const rail = railRef.current
    if (!rail || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      rail.style.setProperty("--rail-h", `${rail.offsetHeight}px`)
    })
    observer.observe(rail)
    return () => observer.disconnect()
  }, [railRef])

  return (id, behavior) => {
    const root = pageRef.current
    if (root) goToSection(root, railRef.current, id, behavior ?? sectionScrollBehavior())
  }
}

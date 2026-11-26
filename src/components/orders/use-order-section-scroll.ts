"use client"

import { useEffect, type RefObject } from "react"
import { useRouter } from "next/navigation"
import { DEFERRED_MOUNT_EVENT } from "@/components/shared/defer-until-visible"
import {
  isOrderSectionId,
  sectionForLegacyTab,
  sectionUrl,
  urlWithout,
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

// Derin bağlantıdan sonra geç gelen içeriğe karşı yeniden hizalama süresi. #911
// UI incelemesinde 2 sn'lik ilk pencereden SONRA ~500px kayma ölçüldü (hasar
// yer tutucusu → 3B görüntüleyici, görseller).
const REALIGN_WINDOW_MS = 6000

/** Hareket azaltma tercihinde anında, değilse yumuşak kaydırma. */
export function sectionScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
}

/** Bölüme kaydırır ve odağı bölüme taşır (klavye ve ekran okuyucu oradan devam eder). */
function scrollToSection(
  root: HTMLElement,
  rail: HTMLElement | null,
  id: OrderSectionId,
  behavior: ScrollBehavior,
): boolean {
  const target = findSectionTarget(root, rail, id)
  if (!target) return false
  target.scrollIntoView({ block: "start", behavior })
  target.focus({ preventScroll: true })
  return true
}

/**
 * Bölüme gidip adresi `#bölüm` yapar. Yalnız hash değiştiği için
 * `history.replaceState` yeter: sunucuya gidilmez, geçmişe kayıt eklenmez.
 *
 * İlk argüman `null` OLMAK ZORUNDA: Next'in yamaladığı `replaceState`,
 * `window.history.state` (`__NA: true`) ile çağrılınca kendi iç çağrısı sanıp
 * yönlendiricinin adresini güncellemiyor; sonraki `router.refresh()` eski
 * adresi geri yazıyordu. `null` verilince Next iç durumu kendisi kopyalar
 * (node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md
 * → "window.history.replaceState").
 */
function goToSection(
  root: HTMLElement,
  rail: HTMLElement | null,
  id: OrderSectionId,
  behavior: ScrollBehavior,
): void {
  if (!scrollToSection(root, rail, id, behavior)) return
  window.history.replaceState(null, "", sectionUrl(window.location.href, id))
}

/**
 * Tek sayfalık araç kabulü detayının gezinmesi (#911). Döndürdüğü işlev
 * bölüme kaydırır; ayrıca:
 *
 * - Açılışta eski `?tab=` bağlantısını (liste, bildirim, uyarı) ya da `#bölüm`
 *   adresini o bölüme kaydırır. `?tab=` adresten `router.replace(…, { scroll:
 *   false })` ile düşer (bkz. `sectionUrl`: sorgu değişikliği replaceState ile
 *   yapılırsa sonraki yenileme sayfayı kaydırıyordu). Üstteki eşzamansız içerik (küçük resimler,
 *   tembel bağlanan hasar haritası, 3B görüntüleyici) yüklendikçe hedef aşağı
 *   kayar: kullanıcı ilk girdiyi verene (tekerlek, dokunma, tuş, tıklama) ya da
 *   ~6 sn geçene kadar sayfa boyu değiştikçe, tembel bir blok bağlandıkça
 *   (`DEFERRED_MOUNT_EVENT`) ve tarayıcı kendisi kaydırdıkça (yeniden yüklemede
 *   konum geri yükleme) yeniden hizalanır.
 * - İki kolonda yapışkan rayın yüksekliğini `--rail-h` olarak yazar; ray
 *   görünür alandan uzunsa CSS onu alt kenarı görünecek yerde yapıştırır.
 */
export function useOrderSectionScroll(
  pageRef: RefObject<HTMLElement | null>,
  railRef: RefObject<HTMLElement | null>,
): (id: OrderSectionId, behavior?: ScrollBehavior) => void {
  const router = useRouter()

  useEffect(() => {
    const root = pageRef.current
    if (!root) return
    const hash = window.location.hash.slice(1)
    const tab = new URLSearchParams(window.location.search).get("tab")
    const id = sectionForLegacyTab(tab) ?? (isOrderSectionId(hash) ? hash : null)
    if (tab !== null) {
      // Tek seferlik: yeniden yükleme aynı yere düşsün, ama sorgu Next'in ağacıyla birlikte değişsin.
      const cleaned = id ? sectionUrl(window.location.href, id, ["tab"]) : urlWithout(window.location.href, ["tab"])
      if (cleaned) router.replace(cleaned, { scroll: false })
    }
    if (!id) return

    scrollToSection(root, railRef.current, id, "auto")

    const realign = () => findSectionTarget(root, railRef.current, id)?.scrollIntoView({ block: "start" })
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(realign)
    resize?.observe(root)
    root.addEventListener(DEFERRED_MOUNT_EVENT, realign)
    // Kullanıcı girdisi gelmeden olan kaydırma tarayıcınındır (yeniden yüklemede
    // kaydırma konumunu geri yükleme, kaydırma çapası): hedefe geri dön.
    // Hizalıyken scrollIntoView kaydırmaz, yeni olay doğmaz.
    window.addEventListener("scroll", realign, { passive: true })
    const inputs = ["wheel", "touchstart", "keydown", "pointerdown"] as const
    const stop = () => {
      resize?.disconnect()
      root.removeEventListener(DEFERRED_MOUNT_EVENT, realign)
      window.removeEventListener("scroll", realign)
      window.clearTimeout(timer)
      for (const type of inputs) window.removeEventListener(type, stop)
    }
    const timer = window.setTimeout(stop, REALIGN_WINDOW_MS)
    for (const type of inputs) window.addEventListener(type, stop, { passive: true })
    return stop
  }, [pageRef, railRef, router])

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

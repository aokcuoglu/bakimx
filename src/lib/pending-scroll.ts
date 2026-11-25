/**
 * Henüz DOM'da olmayabilen bir öğeye kaydırma isteği (#838).
 *
 * Radix Tabs pasif paneli unmount eder ve yeni panelin içeriğini sekme
 * değiştikten SONRAKİ render'da bağlar (Presence). Sekmeyi değiştirip
 * `[activeTab]` effect'inde `ref.current?.scrollIntoView()` çağırmak bu yüzden
 * boş ref görür ve sessizce hiçbir şey yapmaz — iş emri detayında telefondaki
 * toplam çubuğu Özet'i açıp Fiyatlandırma kartına kaymıyordu.
 *
 * Burada kaydırma, öğe gerçekten bağlandığı anda (callback ref) yapılır:
 * öğe varsa `request()` hemen kaydırır, yoksa istek bekler ve `attach(öğe)`
 * geldiğinde bir kez tüketilir. Zamanlama tahmini (gecikme, rAF) yoktur.
 */
export type PendingScroll = {
  /**
   * Hedef öğenin callback ref'i: `<div ref={scroll.attach}>`. (Adı `ref`
   * değil: React Compiler `.ref` erişimini ref nesnesi sanıp render'da okuma
   * hatası verir; bu düz bir callback.)
   */
  attach: (node: HTMLElement | null) => void
  /** Öğeye kaydır; öğe henüz yoksa bağlandığında kaydırılır. */
  request: () => void
}

export function createPendingScroll(scroll: (node: HTMLElement) => void): PendingScroll {
  let node: HTMLElement | null = null
  let pending = false
  return {
    attach(next) {
      node = next
      if (next && pending) {
        pending = false
        scroll(next)
      }
    },
    request() {
      if (node) scroll(node)
      else pending = true
    },
  }
}

/** Sayfa içi bölüme yumuşak kaydırma; hedefin `scroll-mt-*` payı korunur. */
export function scrollToSection(node: HTMLElement) {
  node.scrollIntoView({ behavior: "smooth", block: "start" })
}

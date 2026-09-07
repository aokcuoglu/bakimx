const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

/**
 * Sayfanın başına dönen tüm landing kontrolleri aynı hareket sözleşmesini
 * kullanır. Sistem animasyonu azaltmayı istiyorsa kaydırma anında tamamlanır.
 */
export function scrollToPageTop() {
  const behavior = window.matchMedia(REDUCED_MOTION_QUERY).matches
    ? "auto"
    : "smooth"

  window.scrollTo({ top: 0, left: 0, behavior })
}

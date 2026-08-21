import { useSyncExternalStore } from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches
}

function getServerSnapshot() {
  return false
}

/**
 * Hareket azaltma tercihi — framer-motion'ın `useReducedMotion`ının yerini alır
 * (BAK-165).
 *
 * Yalnız tercihi JS'te OKUMASI gereken yerler içindir: `RuhsatDemoSection`ın
 * zamanlayıcı kurgusu gibi, animasyon yerine akışın kendisi değiştiğinde. Sırf
 * bir animasyonu kısmak için buna uzanma — `.enter-up` ve `[data-reveal]`
 * tercihi zaten CSS'te, hiç JS çalışmadan karşılıyor.
 */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

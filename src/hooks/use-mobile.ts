import { useSyncExternalStore } from "react"

// Tailwind `lg` kırılımının (`width >= 64rem`) BİREBİR aynısı. Sidebar'ın
// masaüstü kabı CSS'te `hidden lg:block`, üst bar ise `lg:` ile gizleniyor;
// JS'in "mobil mi" kararı da aynı sorgudan gelmeli. Eskiden `innerWidth < 1024`
// (px) okunuyordu: rem kırılımı tarayıcının varsayılan yazı boyutuna göre kayar
// (ör. 14px'te 64rem = 896px), px kaymaz. Arada CSS "masaüstü" deyip üst barı,
// JS "mobil" deyip sidebar'ı gizliyordu — gezinme tamamen kayboluyordu.
const DESKTOP_QUERY = "(min-width: 64rem)"

function subscribe(callback: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot() {
  return !window.matchMedia(DESKTOP_QUERY).matches
}

function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

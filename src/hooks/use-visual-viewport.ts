import { useSyncExternalStore } from "react"

/**
 * Görünen alanın (visual viewport) yüksekliği ve üst kayması.
 *
 * Telefonda klavye açılınca layout viewport küçülmez (iOS Safari), yani
 * `100vh`/`100dvh` ve Base UI'ın `--available-height`'i klavyenin ALTINA uzanır.
 * Klavyenin hemen üstünde bitmesi gereken bir yüzey bu değerle boyutlanır.
 * `visualViewport` yoksa (eski tarayıcı, SSR) `null` döner — çağıran `100dvh`e düşer.
 */
export type VisualViewportBox = { height: number; offsetTop: number }

function subscribe(callback: () => void) {
  const vv = window.visualViewport
  if (!vv) return () => {}
  vv.addEventListener("resize", callback)
  vv.addEventListener("scroll", callback)
  return () => {
    vv.removeEventListener("resize", callback)
    vv.removeEventListener("scroll", callback)
  }
}

// Anlık görüntü ilkel olmalı (useSyncExternalStore referans eşitliğiyle karşılaştırır).
function getSnapshot() {
  const vv = window.visualViewport
  return vv ? `${Math.round(vv.height)}:${Math.round(vv.offsetTop)}` : ""
}

function getServerSnapshot() {
  return ""
}

export function useVisualViewport(): VisualViewportBox | null {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  if (!snap) return null
  const [height, offsetTop] = snap.split(":").map(Number)
  return { height, offsetTop }
}

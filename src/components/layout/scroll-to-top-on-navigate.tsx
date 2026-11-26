"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

/**
 * Liste → detay geçişinde sayfayı en üste alır (#892).
 *
 * Next `<Link>` kaydırma konumunu, sayfanın ilk öğesi görünür kaldığı sürece
 * korur. Segment `loading.tsx` yalnız kısa bir spinner çerçevesi çizdiği için
 * tarayıcı kaydırmayı o kısa sayfaya sıkıştırır (ör. 1527 → 43px); çerçeve
 * görünür sayıldığından Next en üste kaydırmaz ve içerik gelince konum
 * (kaydırma çapası yüzünden bazen daha da aşağı) korunur.
 *
 * `behavior: "instant"`: `html { scroll-behavior: smooth }` varsa düz `scrollTo`
 * yukarı doğru animasyon çizer ve konum geçişin sonunda bile 0 olmaz.
 *
 * Yalnız yol (`pathname`) değişince ve geçiş geri/ileri değilse çalışır:
 * - `?tab=`/filtre gibi arama parametresi geçişleri konumu korur,
 * - tarayıcı geri'de Next listenin konumunu kendisi geri yükler.
 */
export function ScrollToTopOnNavigate() {
  const pathname = usePathname()
  const previous = useRef(pathname)
  const historyTraversal = useRef(false)

  useEffect(() => {
    const mark = () => {
      historyTraversal.current = true
    }
    window.addEventListener("popstate", mark)
    return () => window.removeEventListener("popstate", mark)
  }, [])

  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    if (historyTraversal.current) {
      historyTraversal.current = false
      return
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [pathname])

  return null
}

"use client"

import * as React from "react"

/**
 * SSR-güvenli media query hook'u (useSyncExternalStore tabanlı).
 * Sunucuda ve ilk render'da `false` döner; hydration sonrası gerçek değeri alır.
 *
 * Örnek: `const isDesktop = useMediaQuery("(min-width: 1024px)")`
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", callback)
      return () => mql.removeEventListener("change", callback)
    },
    [query]
  )

  const getSnapshot = () => window.matchMedia(query).matches
  const getServerSnapshot = () => false

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

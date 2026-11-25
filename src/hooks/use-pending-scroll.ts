"use client"

import { useState } from "react"
import { createPendingScroll, scrollToSection } from "@/lib/pending-scroll"

/**
 * `[attach, request]`: sekme paneli gibi sonradan bağlanan bir bölüme kaydırma
 * (#838, bkz. `lib/pending-scroll`). `attach` hedefin callback ref'idir
 * (`<div ref={attach}>`), `request()` kaydırır ya da öğe bağlanınca kaydırılmak
 * üzere bekletir. İkisi de bileşen ömrü boyunca sabittir.
 *
 * Demet döner: React Compiler, `ref` prop'una verilen bir nesne üyesini
 * (`scroll.attach`) render sırasında ref okuması sayıyor.
 */
export function usePendingScroll(): [(node: HTMLElement | null) => void, () => void] {
  const [scroll] = useState(() => createPendingScroll(scrollToSection))
  return [scroll.attach, scroll.request]
}

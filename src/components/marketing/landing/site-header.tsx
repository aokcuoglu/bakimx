"use client"

import { usePathname } from "next/navigation"
import { LandingHeader } from "./landing-header"

/**
 * Giriş gerektirmeyen sayfaların ortak üst bandı (#798). `src/app/(site)/layout.tsx`
 * render eder; layout istemci geçişlerinde yeniden mount olmadığı için bant
 * sayfadan sayfaya sabit kalır. Yol yalnız menü bağlantılarının hedefini seçer.
 */
export function SiteHeader() {
  return <LandingHeader anchorBase={usePathname() === "/" ? "" : "/"} />
}

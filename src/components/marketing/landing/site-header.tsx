"use client"

import { usePathname } from "next/navigation"
import { LandingHeader } from "./landing-header"

/**
 * Giriş gerektirmeyen sayfaların ortak üst bandı (#798). `src/app/(site)/layout.tsx`
 * render eder; layout istemci geçişlerinde yeniden mount olmadığı için bant
 * sayfadan sayfaya sabit kalır. Yol menü bağlantılarının hedefini ve telefon hapını seçer (/login kendine link vermez, #807).
 */
export function SiteHeader() {
  const pathname = usePathname()
  return <LandingHeader anchorBase={pathname === "/" ? "" : "/"} mobileAction={pathname === "/login" ? "trial" : "login"} />
}

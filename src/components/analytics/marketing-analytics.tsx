"use client"

import Script from "next/script"
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
import { trackMarketingEvent, type MarketingEventDetail } from "@/lib/marketing-analytics"

declare global { interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void } }

const LANDINGS: Record<string, "home" | "product" | "pricing" | "demo"> = {
  "/": "home", "/fiyatlar": "pricing", "/demo": "demo",
  "/oto-servis-programi": "product", "/is-emri-programi": "product", "/dijital-arac-kabul": "product",
}
export function MarketingAnalytics() {
  const pathname = usePathname()
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  const enabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true"
  const previousPath = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (measurementId) {
      window.dataLayer = window.dataLayer || []
      window.gtag = window.gtag || function (...args: unknown[]) { window.dataLayer?.push(args) }
    }
    const forward = (event: Event) => {
      const { name, params } = (event as CustomEvent<MarketingEventDetail>).detail
      window.gtag?.("event", name, params)
    }
    window.addEventListener("bakimx:analytics", forward)
    return () => window.removeEventListener("bakimx:analytics", forward)
  }, [enabled, measurementId])

  useEffect(() => {
    const landingType = LANDINGS[pathname]
    if (!landingType || previousPath.current === pathname) return
    if (trackMarketingEvent("seo_landing_view", { landing_type: landingType })) previousPath.current = pathname
  }, [pathname])

  if (!enabled || !measurementId) return null
  return <>
    <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`} strategy="afterInteractive" />
    <Script id="bakimx-ga4" strategy="afterInteractive">{`
      window.dataLayer = window.dataLayer || [];
      window.gtag = function(){window.dataLayer.push(arguments);};
      window.gtag('js', new Date());
      window.gtag('config', '${measurementId}', { send_page_view: false });
    `}</Script>
  </>
}

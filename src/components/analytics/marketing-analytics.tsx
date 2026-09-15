"use client"

import { claimMarketingConversions } from "@/app/actions/marketing-conversions"
import { DemoAdvertising } from "./demo-advertising"
import Script from "next/script"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import {
  COOKIE_CONSENT_CHANGED_EVENT,
  hasPerformanceConsent,
  type CookieConsentRecord,
} from "@/lib/cookie-consent"
import { captureMarketingAttribution, trackMarketingEvent, type MarketingEventDetail } from "@/lib/marketing-analytics"

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
  const [performanceAllowed, setPerformanceAllowed] = useState(false)

  useEffect(() => {
    const sync = () => setPerformanceAllowed(hasPerformanceConsent())
    sync()
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<CookieConsentRecord>).detail
      setPerformanceAllowed(detail?.preferences.performance === true)
    }
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, onChange)
  }, [])

  useEffect(() => {
    if (!enabled || !performanceAllowed) return
    if (measurementId) {
      window.dataLayer = window.dataLayer || []
      window.gtag = window.gtag || function (...args: unknown[]) { window.dataLayer?.push(args) }
    }
    const forward = (event: Event) => {
      const { name, params } = (event as CustomEvent<MarketingEventDetail>).detail
      if (measurementId) window.gtag?.("event", name, { ...params, send_to: measurementId })
    }
    window.addEventListener("bakimx:analytics", forward)
    return () => window.removeEventListener("bakimx:analytics", forward)
  }, [enabled, measurementId, performanceAllowed])

  useEffect(() => {
    if (!enabled || !performanceAllowed) return
    // The analytics flag is the existing collection gate. No new provider or IDs.
    if (["/", "/fiyatlar", "/register"].includes(pathname)) captureMarketingAttribution()
    // Claim only on authenticated app routes, after the event listener is installed.
    if (pathname === "/dashboard" || pathname.startsWith("/orders") || pathname.startsWith("/settings") || pathname.startsWith("/billing")) {
      const deliver = () => {
        void claimMarketingConversions().then((events) => {
          for (const event of events) trackMarketingEvent(event.name, event.params)
        }).catch(() => { /* Analytics must never block product use. */ })
      }
      deliver()
      // Same-route mutations/refreshes do not change pathname. Also catch late
      // provider confirmations while the owner remains on the billing screen.
      const timer = window.setInterval(deliver, 30_000)
      window.addEventListener("focus", deliver)
      return () => { window.clearInterval(timer); window.removeEventListener("focus", deliver) }
    }
  }, [enabled, pathname, performanceAllowed])

  useEffect(() => {
    if (!performanceAllowed) return
    const landingType = LANDINGS[pathname]
    if (!landingType || previousPath.current === pathname) return
    if (trackMarketingEvent("seo_landing_view", { landing_type: landingType })) previousPath.current = pathname
  }, [pathname, performanceAllowed])

  return <>
    <DemoAdvertising />
    {enabled && measurementId && performanceAllowed && <>
    <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`} strategy="afterInteractive" />
    <Script id="bakimx-ga4" strategy="afterInteractive">{`
      window.dataLayer = window.dataLayer || [];
      window.gtag = function(){window.dataLayer.push(arguments);};
      window.gtag('js', new Date());
      window.gtag('config', '${measurementId}', { send_page_view: false });
    `}</Script>
    </>}
  </>
}

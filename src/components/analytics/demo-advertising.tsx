"use client"

import Script from "next/script"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { COOKIE_CONSENT_CHANGED_EVENT } from "@/lib/cookie-consent"
import { captureDemoAttribution, hasDemoAdvertisingConsent } from "@/lib/demo-attribution"

export function DemoAdvertising() {
  const pathname = usePathname()
  const [allowed, setAllowed] = useState(false)
  const sent = useRef(new Set<string>())
  const adsId = /^AW-[0-9]+$/.test(process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID || "") ? process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID : undefined
  const adsLabel = /^[A-Za-z0-9_-]+$/.test(process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL || "") ? process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL : undefined

  useEffect(() => {
    const sync = () => {
      const consent = hasDemoAdvertisingConsent() && ["/", "/demo", "/demo/ozet"].includes(pathname)
      setAllowed(consent)
      captureDemoAttribution()
      window.gtag?.("consent", "update", { ad_storage: consent ? "granted" : "denied", ad_user_data: consent ? "granted" : "denied", ad_personalization: "denied" })
    }
    sync()
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, sync)
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, sync)
  }, [pathname])

  useEffect(() => {
    if (!allowed) return
    const forward = (event: Event) => {
      if (!hasDemoAdvertisingConsent() || !["/", "/demo", "/demo/ozet"].includes(window.location.pathname)) return
      const eventId = (event as CustomEvent<{ eventId: string }>).detail?.eventId
      if (!eventId || !/^[a-f0-9-]{36}$/.test(eventId) || sent.current.has(eventId)) return
      sent.current.add(eventId)
      if (adsId && adsLabel) window.gtag?.("event", "conversion", { send_to: `${adsId}/${adsLabel}`, transaction_id: eventId, page_location: window.location.origin + window.location.pathname, page_referrer: "", user_data: null })
    }
    window.addEventListener("bakimx:demo-conversion", forward)
    return () => window.removeEventListener("bakimx:demo-conversion", forward)
  }, [allowed, adsId, adsLabel])

  if (!allowed) return null
  return <>
    {adsId && adsLabel && <>
      <Script id="bakimx-demo-ads-config" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
        window.gtag('consent', 'default', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'denied' });
        window.gtag('js', new Date());
        window.gtag('config', '${adsId}', { send_page_view: false, allow_enhanced_conversions: false, page_location: window.location.origin + window.location.pathname, page_referrer: '' });
      `}</Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${adsId}`} strategy="afterInteractive" referrerPolicy="no-referrer" />
    </>}
  </>
}

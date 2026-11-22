import { trackMarketingEvent } from "@/lib/marketing-analytics"

/** Pazarlama CTA'sının ölçüm tanımı — sunucu bileşenlerinden seri hâle getirilebilir veri olarak geçer. */
export type CtaTrack =
  | { name: "trial_cta_click"; location: string }
  | { name: "demo_cta_click"; location: string; destination: "form" | "assistant" | "callback_modal" }

export function trackCta(track: CtaTrack): void {
  if (track.name === "trial_cta_click") {
    trackMarketingEvent("trial_cta_click", { cta_location: track.location })
    return
  }
  trackMarketingEvent("demo_cta_click", { cta_location: track.location, destination: track.destination })
}

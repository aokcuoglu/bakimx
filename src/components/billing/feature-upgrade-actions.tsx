"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowRight, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FEATURE_CATALOG, type FeatureDefinition } from "@/lib/feature-catalog"
import { trackMarketingEvent } from "@/lib/marketing-analytics"
import type { GatedFeature, PlanTier } from "@/lib/plan"
import { getSupportWhatsAppUrl } from "@/lib/support-whatsapp"

type Props = {
  feature: GatedFeature
  currentTier: PlanTier
  kind: FeatureDefinition["kind"]
  placement: "page" | "inline"
  compact?: boolean
}

/**
 * Kilitli özelliğin eylemleri (#782).
 *  - `package`: özellik Servis Paketi'nde var (eski Lite/Başlangıç satırı) → paketi satın al.
 *  - `addon`: pakete dahil değil ve henüz satılmıyor → /checkout'a GÖNDERME; tek
 *    birincil eylem iletişim, yanında "yakında satın alınabilir" notu.
 */
export function FeatureUpgradeActions({ feature, currentTier, kind, placement, compact }: Props) {
  useEffect(() => {
    trackMarketingEvent("feature_paywall_viewed", {
      feature_id: feature,
      current_tier: currentTier,
      kind,
      placement,
    })
  }, [currentTier, feature, kind, placement])

  function trackClick(destination: "checkout" | "plans" | "contact") {
    trackMarketingEvent("feature_upgrade_clicked", {
      feature_id: feature,
      current_tier: currentTier,
      kind,
      placement,
      destination,
    })
  }

  const size = compact ? "sm" : "lg"

  if (kind === "addon") {
    const message = `Merhaba, BakımX ${FEATURE_CATALOG[feature].name} ek özelliği hakkında bilgi almak istiyorum.`
    return (
      <div className={compact ? "flex flex-col gap-2 sm:items-start" : "flex flex-col items-center gap-2"}>
        <Button variant="foreground" asChild size={size}>
          <Link
            href={getSupportWhatsAppUrl(message)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackClick("contact")}
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            Bizimle iletişime geçin
          </Link>
        </Button>
        <p className="text-xs text-muted-foreground">Ek özellik — yakında uygulama içinden satın alınabilecek.</p>
      </div>
    )
  }

  return (
    <div className={compact ? "flex flex-col gap-2 sm:flex-row" : "flex flex-col gap-3 sm:flex-row sm:justify-center"}>
      <Button variant="foreground" asChild size={size}>
        <Link href="/checkout?cycle=monthly" onClick={() => trackClick("checkout")}>
          Paketi satın al
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>
      <Button asChild size={size} variant="outline">
        <Link href="/settings/plans" onClick={() => trackClick("plans")}>
          Pakete neler dahil?
        </Link>
      </Button>
    </div>
  )
}

"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowRight, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { addonPurchaseHref, purchasableAddonKeyForFeature } from "@/lib/billing/addon-purchase"
import { formatAddonMinor, getAddonPriceMinor } from "@/lib/billing/addon-pricing"
import { addonContactMessage, type FeatureDefinition } from "@/lib/feature-catalog"
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
 *  - `addon`: pakete dahil değil → /checkout'a GÖNDERME. Fiyatlı ve satılan ek
 *    özellikte birincil eylem Ayarlar → Paketler'deki satın alma penceresidir
 *    (#829); satılmayanlarda iletişim.
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

  function trackClick(destination: "checkout" | "plans" | "contact" | "addon_purchase") {
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
    const purchaseKey = purchasableAddonKeyForFeature(feature)
    if (purchaseKey) {
      return (
        <div className={compact ? "flex flex-col gap-2 sm:items-start" : "flex flex-col items-center gap-2"}>
          <Button variant="foreground" asChild size={size}>
            <Link href={addonPurchaseHref(purchaseKey)} onClick={() => trackClick("addon_purchase")}>
              Satın al
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Ek özellik — {formatAddonMinor(getAddonPriceMinor(purchaseKey, "monthly"))}/ay · KDV dahil
          </p>
        </div>
      )
    }
    const message = addonContactMessage(feature)
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
        <p className="text-xs text-muted-foreground">Ek özellik — henüz uygulama içinden satın alınamıyor.</p>
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

"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { trackMarketingEvent } from "@/lib/marketing-analytics"
import type { GatedFeature, PlanTier } from "@/lib/plan"

type Props = {
  feature: GatedFeature
  currentTier: PlanTier
  targetTier: Extract<PlanTier, "pro" | "premium">
  placement: "page" | "inline"
  compact?: boolean
}

export function FeatureUpgradeActions({ feature, currentTier, targetTier, placement, compact }: Props) {
  useEffect(() => {
    trackMarketingEvent("feature_paywall_viewed", {
      feature_id: feature,
      current_tier: currentTier,
      target_tier: targetTier,
      placement,
    })
  }, [currentTier, feature, placement, targetTier])

  function trackClick(destination: "checkout" | "plans") {
    trackMarketingEvent("feature_upgrade_clicked", {
      feature_id: feature,
      current_tier: currentTier,
      target_tier: targetTier,
      placement,
      destination,
    })
  }

  return (
    <div className={compact ? "flex flex-col gap-2 sm:flex-row" : "flex flex-col gap-3 sm:flex-row sm:justify-center"}>
      <Button asChild size={compact ? "sm" : "lg"}>
        <Link
          href={`/checkout?tier=${targetTier}&cycle=monthly`}
          onClick={() => trackClick("checkout")}
        >
          {targetTier === "premium" ? "Premium'a geç" : "Profesyonel'e geç"}
          <ArrowRight className="size-4" />
        </Link>
      </Button>
      <Button asChild size={compact ? "sm" : "lg"} variant="outline">
        <Link href="/billing#plans" onClick={() => trackClick("plans")}>
          Paketleri karşılaştır
        </Link>
      </Button>
    </div>
  )
}

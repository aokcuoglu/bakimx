"use client"

import { LockKeyhole } from "lucide-react"
import { FeatureUpgradeActions } from "@/components/billing/feature-upgrade-actions"
import { FEATURE_CATALOG } from "@/lib/feature-catalog"
import type { GatedFeature, PlanTier } from "@/lib/plan"

export function InlineFeatureUpsell({
  feature,
  currentTier,
}: {
  feature: GatedFeature
  currentTier: PlanTier
}) {
  const definition = FEATURE_CATALOG[feature]
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 text-primary-strong">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <LockKeyhole className="size-4" />
        </div>
        <div>
          <p className="font-semibold">{definition.name}</p>
          <p className="mt-0.5 text-sm">{definition.description}</p>
        </div>
      </div>
      <FeatureUpgradeActions
        feature={feature}
        currentTier={currentTier}
        targetTier={definition.targetTier}
        placement="inline"
        compact
      />
    </div>
  )
}

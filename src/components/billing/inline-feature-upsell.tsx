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
    <div className="rounded-lg border border-border bg-card p-4 text-foreground">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
          <LockKeyhole className="size-4" />
        </div>
        <div>
          <p className="font-semibold">{definition.name}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{definition.description}</p>
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

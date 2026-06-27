import { prisma } from "@/lib/db"
import { hasFeature, type GatedFeature, type PlanTier } from "@/lib/plan"

/** Founder-toggleable gated features (the GatedFeature union, enumerated). */
export const GATED_FEATURES: GatedFeature[] = ["aiAdvisor", "eInvoice", "multiBranch", "rbac"]

export const FEATURE_LABELS: Record<GatedFeature, string> = {
  aiAdvisor: "AI Servis Danışmanı",
  eInvoice: "e-Fatura",
  multiBranch: "Çoklu şube",
  rbac: "Rol tabanlı yetki",
}

export function isGatedFeature(key: string): key is GatedFeature {
  return (GATED_FEATURES as string[]).includes(key)
}

/**
 * Effective feature gate. Composes with — does NOT replace — hasFeature():
 *  1. A per-tenant override (not expired) wins.
 *  2. Otherwise fall back to the plan tier via hasFeature().
 *
 * Fail-safe: any lookup error falls back to the tier floor, so a DB hiccup can
 * never accidentally unlock a premium feature globally.
 */
export async function resolveFeature(
  workshopId: string,
  tier: PlanTier,
  feature: GatedFeature,
): Promise<boolean> {
  try {
    const override = await prisma.workshopFeatureOverride.findUnique({
      where: { workshopId_featureKey: { workshopId, featureKey: feature } },
      select: { enabled: true, expiresAt: true },
    })
    if (override && (override.expiresAt == null || override.expiresAt.getTime() > Date.now())) {
      return override.enabled
    }
  } catch (err) {
    console.error(
      "[resolveFeature] lookup failed, falling back to tier:",
      err instanceof Error ? err.message : err,
    )
  }
  return hasFeature(tier, feature)
}

export interface EffectiveFeature {
  key: GatedFeature
  label: string
  /** What the plan tier alone grants. */
  tierGrants: boolean
  /** The override row, if any. */
  override: { enabled: boolean; expiresAt: Date | null; reason: string | null } | null
  /** Net effect after applying the override (expired overrides ignored). */
  effective: boolean
}

/** All gated features with their tier baseline + any active override — for the
 *  admin flags UI. Fail-safe: on error, returns tier-only effects. */
export async function getEffectiveFeatures(
  workshopId: string,
  tier: PlanTier,
): Promise<EffectiveFeature[]> {
  let overrides: { featureKey: string; enabled: boolean; expiresAt: Date | null; reason: string | null }[] = []
  try {
    overrides = await prisma.workshopFeatureOverride.findMany({
      where: { workshopId },
      select: { featureKey: true, enabled: true, expiresAt: true, reason: true },
    })
  } catch (err) {
    console.error("[getEffectiveFeatures] lookup failed:", err instanceof Error ? err.message : err)
  }

  const now = Date.now()
  return GATED_FEATURES.map((key) => {
    const tierGrants = hasFeature(tier, key)
    const row = overrides.find((o) => o.featureKey === key) ?? null
    const active = row && (row.expiresAt == null || row.expiresAt.getTime() > now)
    return {
      key,
      label: FEATURE_LABELS[key],
      tierGrants,
      override: row ? { enabled: row.enabled, expiresAt: row.expiresAt, reason: row.reason } : null,
      effective: active ? row.enabled : tierGrants,
    }
  })
}

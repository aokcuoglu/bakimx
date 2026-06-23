"use server"

import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import type { PlanTier } from "@/lib/plan"

const VALID_TIERS: PlanTier[] = ["starter", "pro", "premium"]

/**
 * Records a self-serve package-upgrade request. Until iyzico billing lands, an
 * admin activates the requested plan via `scripts/workshop-admin.ts set-plan`.
 *
 * workshopId is derived from the session (requireAuth) — never trusted from the
 * client — to preserve tenant isolation.
 */
export async function requestPlanActivation(
  tier: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireAuth()

  if (!VALID_TIERS.includes(tier as PlanTier)) {
    return { ok: false, error: "Geçersiz paket seçimi." }
  }

  await prisma.workshop.update({
    where: { id: user.workshopId },
    data: {
      requestedPlanTier: tier as PlanTier,
      planRequestedAt: new Date(),
    },
  })

  await AuditLogAction(
    user.workshopId,
    user.id,
    "Workshop",
    user.workshopId,
    "plan_activation_requested",
    JSON.stringify({ tier })
  )

  revalidatePath("/app/billing")
  revalidatePath("/app")

  return { ok: true }
}

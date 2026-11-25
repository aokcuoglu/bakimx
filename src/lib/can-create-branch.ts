import type { UserRole, Workshop } from "@prisma/client"
import { hasWorkshopFeature } from "@/lib/plan"

type WorkshopPlanFields = Pick<
  Workshop,
  "planTier" | "subscriptionStatus" | "approvalStatus" | "trialEndsAt" | "currentPeriodEnd"
> & { liteFreeGrantedAt?: Date | null }

/** Owner + çoklu şube ek özelliği (deneme ya da "Paket + ek özellikler") may create another branch. */
export function canCreateBranch(
  input: WorkshopPlanFields & { role: UserRole },
): boolean {
  if (input.role !== "owner") return false
  return hasWorkshopFeature(input, "multiBranch")
}

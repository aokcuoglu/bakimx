import type { UserRole } from "@prisma/client"
import { hasWorkshopFeature, type WorkshopEntitlementFields } from "@/lib/plan"

/**
 * Owner + çoklu şube ek özelliği (deneme, "Paket + ek özellikler" ya da
 * atölyenin `addons` listesinde `multiBranch`, #827) may create another branch.
 */
export function canCreateBranch(
  input: WorkshopEntitlementFields & { role: UserRole },
): boolean {
  if (input.role !== "owner") return false
  return hasWorkshopFeature(input, "multiBranch")
}

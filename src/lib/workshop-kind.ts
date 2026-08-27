import type { WorkshopKind } from "@prisma/client"

/** Migration ile oluşturulan tek iç personel container'ının sabit kimliği. */
export const INTERNAL_OPERATIONS_WORKSHOP_ID = "bakimx-internal-operations"

/** Tenant yüzeyinin fail-closed workshop türü kapısı. */
export function isCustomerWorkshopKind(kind: WorkshopKind | string | null | undefined): boolean {
  return kind === "customer"
}

export function supplierDisplayName(supplier: { name: string; contactPerson?: string | null }): string {
  return supplier.name
}

export function formatDeliveryDays(days: number | null | undefined): string {
  if (days == null) return "—"
  return `${days} gün`
}

export function formatPaymentTermDays(days: number | null | undefined): string {
  if (days == null) return "—"
  return `${days} gün`
}
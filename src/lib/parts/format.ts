import { kurusToLira } from "@/lib/money"

export function formatStockQty(qty: number): string {
  return qty.toLocaleString("tr-TR")
}

/** Format a price stored in minor units (kuruş/cents) for the given currency. */
export function formatPrice(value: number | null | undefined, currency = "TRY"): string {
  if (value == null) return "—"
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(kurusToLira(value))
}

export function partDisplayName(name: string, sku?: string | null): string {
  if (sku) return `${name} (${sku})`
  return name
}

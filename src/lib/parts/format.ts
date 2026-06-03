export function formatStockQty(qty: number): string {
  return qty.toLocaleString("tr-TR")
}

export function formatPrice(value: number | null | undefined, currency = "TRY"): string {
  if (value == null) return "—"
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function partDisplayName(name: string, sku?: string | null): string {
  if (sku) return `${name} (${sku})`
  return name
}

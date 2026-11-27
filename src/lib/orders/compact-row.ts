import { formatTRY } from "@/lib/format"
import { ORDER_ITEM_UNITS, ORDER_ITEM_UNIT_LABELS } from "@/lib/orders/quantity"

export const PRICE_NOT_ENTERED = "Fiyat girilmedi"

type CompactRowInput = {
  type: string
  quantity: number
  unit: string | null
  unitPrice: number | null
}

/** Miktar Türkçe yazılır: en çok üç ondalık, binlik ayraçsız ("1,5", "12"). */
export function formatCompactQuantity(quantity: number): string {
  return quantity.toLocaleString("tr-TR", { maximumFractionDigits: 3, useGrouping: false })
}

/**
 * Kompakt kalem satırının ikinci satırındaki "{adet} {birim} × {birim fiyat}"
 * metni (#968). Birim yalnız parçada vardır; işçilikte "adet". Fiyat yoksa
 * ya da sıfırsa satır tutarı da "—" okunduğu için aynı kural: "Fiyat girilmedi".
 */
export function compactRowDetail(row: CompactRowInput): string {
  if (row.unitPrice == null || row.unitPrice <= 0) return PRICE_NOT_ENTERED
  const unit = row.type === "part"
    ? ORDER_ITEM_UNITS.find((candidate) => candidate === row.unit) ?? "adet"
    : "adet"
  const label = ORDER_ITEM_UNIT_LABELS[unit].toLocaleLowerCase("tr-TR")
  return `${formatCompactQuantity(row.quantity)} ${label} × ${formatTRY(row.unitPrice)}`
}

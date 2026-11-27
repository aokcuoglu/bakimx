import { calculateOrderTotalsFromMinimal, type MinimalLineItem } from "@/lib/totals"

/**
 * `ServiceOrder.grandTotal` — listenin sunucu tarafı "Toplam" sıralaması için
 * saklanan genel toplam (kuruş, #831). Tek hesap kaynağı `calculateOrderTotals`;
 * burada yalnız "fiyatlı kalem yoksa null" kuralı eklenir (listede "—" ile
 * aynı karar: `hasAnyPrice`). `recalcOrderPayment` ve backfill betiği bunu kullanır.
 */
export function computeStoredGrandTotal(
  items: MinimalLineItem[],
  options: { discountAmount?: number | null; taxRate?: number | null }
): number | null {
  const totals = calculateOrderTotalsFromMinimal(items, options)
  return totals.hasAnyPrice ? totals.grandTotal : null
}

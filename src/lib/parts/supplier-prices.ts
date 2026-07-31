/**
 * Parça ↔ tedarikçi alış fiyatı satırlarının saf mantığı.
 *
 * `purchasePrice` birim-nötrdür: form katmanı lira, server katmanı kuruş
 * geçirir. Para birimi burada türetilmez — tüm satırlar parçanın para
 * birimini paylaşır.
 */
export type SupplierPriceRow = {
  supplierId: string
  purchasePrice: number
  supplierSku: string
  isPreferred: boolean
}

/**
 * Tedarikçisi seçilmemiş satırları atar ve tam olarak bir satırı varsayılan
 * bırakır (işaretli yoksa ilk satır). Boş liste boş döner.
 */
export function normalizeSupplierPriceRows(rows: SupplierPriceRow[]): SupplierPriceRow[] {
  const filled = rows.filter((r) => r.supplierId.trim().length > 0)
  if (filled.length === 0) return []
  const preferredIndex = filled.findIndex((r) => r.isPreferred)
  const winner = preferredIndex === -1 ? 0 : preferredIndex
  return filled.map((r, i) => ({ ...r, isPreferred: i === winner }))
}

/**
 * `PartStockItem` üzerindeki türetilmiş alanları hesaplar. Varsayılan satır
 * yoksa (hiç tedarikçi eklenmemişse) ikisi de null olur.
 */
export function derivePartPricing(rows: SupplierPriceRow[]): {
  purchasePrice: number | null
  supplierId: string | null
} {
  const preferred = rows.find((r) => r.isPreferred)
  if (!preferred) return { purchasePrice: null, supplierId: null }
  return { purchasePrice: preferred.purchasePrice, supplierId: preferred.supplierId }
}

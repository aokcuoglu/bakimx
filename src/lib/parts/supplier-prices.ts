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

/**
 * Güncellemede türetilmiş alanların (`purchasePrice`, `supplierId`) update
 * data'sına konup konmayacağına karar verir. `true` = alanlar data'dan tümüyle
 * çıkarılır (Prisma mevcut değeri korur).
 *
 * Neden: tedarikçi satırları bu dalda geldi, backfill ise yalnız hem carisi
 * hem fiyatı olan parçalara satır üretebildi (satır `supplierId` olmadan
 * yazılamaz). Eski form iki alanı bağımsız/opsiyonel tuttuğu için satırsız ama
 * fiyatlı/carili parçalar var. Onlar düzenlenirken form boş satır listesi
 * gönderir; bu "hepsini sil" sanılırsa kullanıcı yalnız raf konumunu
 * güncellediğinde bile alış fiyatı ve tedarikçi sessizce silinir.
 *
 * Ayrım: satır listesi boş VE parçanın önceden de satırı YOKSA veri hiç
 * taşınmamıştır → korunur. Önceden satır VARDI ve şimdi boş liste geldiyse
 * kullanıcı gerçekten hepsini silmiştir → türetilmiş alanlar `null`'a düşer.
 */
export function shouldPreserveDerivedPricing(args: {
  /** `supplierPrices` alanı istekte gönderildi mi (gönderilmediyse hiç dokunulmaz). */
  touched: boolean
  /** İstekte gelen (normalize edilmiş) satır sayısı. */
  incomingRowCount: number
  /** Parçanın DB'de hâlihazırda kayıtlı satır sayısı. */
  existingRowCount: number
}): boolean {
  if (!args.touched) return true
  return args.incomingRowCount === 0 && args.existingRowCount === 0
}

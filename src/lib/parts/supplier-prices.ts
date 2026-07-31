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

/**
 * Fiyat alanındaki ham girdinin form state'ine yazılıp yazılmayacağına karar
 * verir. `{ commit: false }` = state'e dokunma, son geçerli değer korunsun.
 *
 * Neden gerekli: `type="number"` girdisinde tarayıcı, YARIM bir sayı için
 * (ör. "1250." ya da "1e") `value` olarak `""` döndürür. Bunu körü körüne 0
 * saymak, ekranda "1250." yazarken state'i sessizce 0 yapar — kullanıcı tam o
 * anda Enter'a basarsa para alanına 0 kaydedilir.
 *
 * Ayrım odak durumundan gelir:
 * - Yazmaya devam ediyor (`final: false`) + ham değer boş → **commit etme**,
 *   eski değer korunur (yarım ondalık yazılıyor olabilir).
 * - Alandan çıkıyor (`final: true`) + ham değer boş → kullanıcı alanı gerçekten
 *   temizlemiştir → 0.
 * - `badInput` (tarayıcı metni sayıya çeviremiyor, ör. "1e") → hiçbir zaman
 *   commit etme; blur'da da 0'a düşürme, son geçerli değere dönülür.
 */
export function resolvePriceDraftCommit(
  rawValue: string,
  options: { final: boolean; badInput?: boolean }
): { commit: false } | { commit: true; value: number } {
  if (options.badInput) return { commit: false }

  const trimmed = rawValue.trim()
  if (trimmed === "") {
    return options.final ? { commit: true, value: 0 } : { commit: false }
  }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return { commit: false }
  return { commit: true, value: parsed }
}

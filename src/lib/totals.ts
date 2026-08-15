import { sumKurus, applyDiscountKurus, applyTaxBps, addKurus, formatKurus, mulDivRound } from "@/lib/money"

/**
 * Order/quote totals. All money values are integer KURUŞ; `taxRate` is integer
 * BASIS POINTS (bps; %20 = 2000). money.ts is the single rounding authority —
 * kuruş addition is exact, only the tax share rounds.
 *
 * SATIR BAZLI KDV (BAK-53). `includeVat` bir satırın KDV'ye TABİ olup olmadığını
 * söyler; `false` olan satır belgenin KDV'sini almaz. Alan yoksa/`null` ise
 * **tabidir** — eski kayıtlar ve bu alanı hiç göndermeyen çağıranlar bugünkü
 * davranışı birebir sürdürsün diye varsayılan bilerek `true` tarafında.
 *
 * Tüm satırlar tabiyken formül bugünküyle AYNI sonucu verir (bkz. totals.test.ts):
 * `taxableSubtotal === subtotal` olduğunda aşağıdaki oranlama kimlik fonksiyonu.
 */

export type OrderLineItem = {
  type: string
  name: string
  quantity: number
  unitPrice: number | null // kuruş
  totalPrice: number | null // kuruş
  /** Satır belgenin KDV'sine tabi mi? Yok/null → tabi (geriye dönük uyum). */
  includeVat?: boolean | null
}

export type OrderTotalsOptions = {
  discountAmount?: number | null // kuruş
  taxRate?: number | null // bps
}

export type MinimalLineItem = {
  totalPrice: number | null // kuruş
  unitPrice: number | null // kuruş
  quantity: number
  /** Satır belgenin KDV'sine tabi mi? Yok/null → tabi (geriye dönük uyum). */
  includeVat?: boolean | null
}

/**
 * Toplam hesaplayan HER Prisma sorgusunun kalem `select`'i — tek kaynak (BAK-53).
 *
 * `includeVat` burada olmak ZORUNDA: düşerse Prisma alanı hiç döndürmez,
 * `isVatLiable` `undefined` görüp satırı TABİ sayar ve KDV muaf kalemden de
 * alınır. Ekrandaki iş emri (tam nesneyle okur) doğru, kasa/rapor yanlış çıkar —
 * yani hata sessizdir ve iki yüzey birbirini tutmaz. Elle alan sıralamak yerine
 * bu sabiti kullan; `order-totals-select.test.ts` bunu tarayarak zorluyor.
 */
export const ORDER_TOTALS_ITEM_SELECT = {
  totalPrice: true,
  unitPrice: true,
  quantity: true,
  type: true,
  includeVat: true,
} as const

/** Satır KDV'ye tabi mi — tek karar noktası, `null`/`undefined` tabi sayılır. */
export function isVatLiable(item: { includeVat?: boolean | null }): boolean {
  return item.includeVat !== false
}

/**
 * Belge indirimi KDV'ye tabi kısma ORANTILI dağıtılır, sonra KDV o kısma
 * uygulanır.
 *
 * Neden orantılı: indirim belgenin tamamına yazılıyor, dolayısıyla KDV'siz bir
 * kalem de ondan payını alır. İndirimin tamamı tabi kısımdan düşülseydi KDV
 * matrahı olduğundan küçük çıkar, tamamı muaf kısımdan düşülseydi büyük çıkardı;
 * ikisi de faturayı yanlış yapar.
 *
 * Tüm satırlar tabiyken `taxableSubtotal === subtotal` olur ve fonksiyon
 * `subtotal - discount` döner — yani bugünkü hesabın ta kendisi.
 */
function taxableBaseKurus(subtotal: number, taxableSubtotal: number, discount: number): number {
  if (taxableSubtotal <= 0) return 0
  if (subtotal <= 0) return 0
  const discountShare = discount <= 0 ? 0 : mulDivRound(discount, taxableSubtotal, subtotal)
  return Math.max(0, taxableSubtotal - discountShare)
}

/** Line total in kuruş: explicit totalPrice wins, else unitPrice * quantity. */
function lineTotalKurus(item: MinimalLineItem): number {
  if (item.totalPrice != null && item.totalPrice > 0) return Math.trunc(item.totalPrice)
  if (item.unitPrice != null && item.unitPrice > 0) return Math.trunc(item.unitPrice) * item.quantity
  return 0
}

function hasPrice(item: MinimalLineItem): boolean {
  return (item.totalPrice != null && item.totalPrice > 0) || (item.unitPrice != null && item.unitPrice > 0)
}

export function calculateMinimalTotal(items: MinimalLineItem[]): number {
  return sumKurus(items.map(lineTotalKurus))
}

export function calculateOrderTotalsFromMinimal(
  items: MinimalLineItem[],
  options: OrderTotalsOptions = {}
): {
  grandTotal: number
  hasAnyPrice: boolean
} {
  const subtotal = calculateMinimalTotal(items)
  const discount = Math.max(0, options.discountAmount ?? 0)
  const afterDiscount = applyDiscountKurus(subtotal, discount)
  const taxableSubtotal = sumKurus(items.filter(isVatLiable).map(lineTotalKurus))
  const taxAmount = applyTaxBps(
    taxableBaseKurus(subtotal, taxableSubtotal, discount),
    options.taxRate ?? 0,
  )
  const grandTotal = addKurus(afterDiscount, taxAmount)
  return { grandTotal, hasAnyPrice: items.some(hasPrice) }
}

export function calculateLineTotal(item: OrderLineItem): number | null {
  if (item.totalPrice != null && item.totalPrice > 0) return Math.trunc(item.totalPrice)
  if (item.unitPrice != null && item.unitPrice > 0) return Math.trunc(item.unitPrice) * item.quantity
  return null
}

export function formatLineTotal(item: OrderLineItem): string {
  const total = calculateLineTotal(item)
  if (total != null) return formatKurus(total)
  return "Fiyat girilmedi"
}

export function calculateGroupTotal(items: OrderLineItem[], type?: string): number {
  const filtered = type ? items.filter((i) => i.type === type) : items
  return sumKurus(filtered.map(lineTotalKurus))
}

export function calculateOrderTotals(
  items: OrderLineItem[],
  options: OrderTotalsOptions = {}
): {
  partsTotal: number
  laborTotal: number
  externalLaborTotal: number
  subtotal: number
  /** KDV'ye tabi kalemlerin net toplamı — muaf satır varken `subtotal`'dan küçüktür. */
  taxableSubtotal: number
  discountAmount: number
  taxRate: number
  taxAmount: number
  grandTotal: number
  partsCount: number
  laborCount: number
  externalLaborCount: number
  hasAnyPrice: boolean
} {
  const partsTotal = calculateGroupTotal(items, "part")
  const laborTotal = calculateGroupTotal(items, "labor")
  const externalLaborTotal = calculateGroupTotal(items, "external_labor")
  const subtotal = sumKurus([partsTotal, laborTotal, externalLaborTotal])
  const discountAmount = Math.max(0, Math.trunc(options.discountAmount ?? 0))
  const afterDiscount = applyDiscountKurus(subtotal, discountAmount)
  const taxRate = Math.max(0, Math.trunc(options.taxRate ?? 0))
  const taxableSubtotal = sumKurus(items.filter(isVatLiable).map(lineTotalKurus))
  const taxAmount = applyTaxBps(
    taxableBaseKurus(subtotal, taxableSubtotal, discountAmount),
    taxRate,
  )
  const grandTotal = addKurus(afterDiscount, taxAmount)

  return {
    partsTotal,
    laborTotal,
    externalLaborTotal,
    subtotal,
    taxableSubtotal,
    discountAmount,
    taxRate,
    taxAmount,
    grandTotal,
    partsCount: items.filter((i) => i.type === "part").length,
    laborCount: items.filter((i) => i.type === "labor").length,
    externalLaborCount: items.filter((i) => i.type === "external_labor").length,
    hasAnyPrice: items.some(hasPrice),
  }
}

export function formatOrderSummary(
  items: OrderLineItem[],
  options: OrderTotalsOptions = {}
): {
  partsTotal: string
  laborTotal: string
  externalLaborTotal: string
  subtotal: string
  discountAmount: string
  taxAmount: string
  grandTotal: string
  partsCount: number
  laborCount: number
  externalLaborCount: number
  hasAnyPrice: boolean
} {
  const totals = calculateOrderTotals(items, options)

  return {
    partsTotal: totals.partsCount > 0 ? formatKurus(totals.partsTotal) : "—",
    laborTotal: totals.laborCount > 0 ? formatKurus(totals.laborTotal) : "—",
    externalLaborTotal: totals.externalLaborCount > 0 ? formatKurus(totals.externalLaborTotal) : "—",
    subtotal: totals.hasAnyPrice ? formatKurus(totals.subtotal) : "—",
    discountAmount: totals.discountAmount > 0 ? formatKurus(totals.discountAmount) : "—",
    taxAmount: totals.taxRate > 0 ? formatKurus(totals.taxAmount) : "—",
    grandTotal: totals.hasAnyPrice ? formatKurus(totals.grandTotal) : "—",
    partsCount: totals.partsCount,
    laborCount: totals.laborCount,
    externalLaborCount: totals.externalLaborCount,
    hasAnyPrice: totals.hasAnyPrice,
  }
}

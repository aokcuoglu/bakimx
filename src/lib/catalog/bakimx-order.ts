import type { BakimxProductSummary } from "@/lib/parts/bakimx-catalog"

/**
 * BakımX sipariş talebi akışının SAF çekirdeği (BAK-60).
 *
 * Prisma'ya, `next/*`'a ve React'e dokunmaz — hem sunucu yazma yolu (API route +
 * admin action) hem istemci yüzeyi aynı kuralları buradan okur, dolayısıyla
 * "ekranda başka, veritabanında başka" durumu oluşamaz.
 *
 * Akışın iki cümlelik özeti:
 *  • Talep, ürünü İŞ EMRİNE KALEM olarak eklemekten bağımsızdır (kalem ≠ sipariş).
 *  • Stok yalnız `shipped` geçişinde ve tam olarak bir kez düşer.
 */

export type BakimxOrderStatusValue = "requested" | "confirmed" | "shipped" | "cancelled"

export const BAKIMX_ORDER_STATUSES: BakimxOrderStatusValue[] = [
  "requested",
  "confirmed",
  "shipped",
  "cancelled",
]

export const BAKIMX_ORDER_STATUS_LABELS: Record<BakimxOrderStatusValue, string> = {
  requested: "Talep edildi",
  confirmed: "Onaylandı",
  shipped: "Gönderildi",
  cancelled: "İptal edildi",
}

/**
 * İzin verilen durum geçişleri.
 *
 * `requested → shipped` BİLEREK yok: sevkiyat stok düşüren tek geçiş olduğu için
 * önünde açık bir onay adımı durur. `shipped` ve `cancelled` terminaldir —
 * `shipped`'ten çıkış olmaması invaryant 3'ün (düşüm bir kez olur) yarısıdır;
 * diğer yarısı geçişin transaction içinde mevcut durumu koşula almasıdır.
 */
const ALLOWED_TRANSITIONS: Record<BakimxOrderStatusValue, BakimxOrderStatusValue[]> = {
  requested: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: [],
  cancelled: [],
}

export function bakimxOrderTransitions(from: BakimxOrderStatusValue): BakimxOrderStatusValue[] {
  return ALLOWED_TRANSITIONS[from]
}

export function canTransitionBakimxOrder(
  from: BakimxOrderStatusValue,
  to: BakimxOrderStatusValue,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

/** Geçiş reddedildiğinde kullanıcıya dönen mesaj (tek yerde, iki yüzey aynısını basar). */
export function bakimxOrderTransitionError(
  from: BakimxOrderStatusValue,
  to: BakimxOrderStatusValue,
): string {
  if (from === to) return `Sipariş zaten "${BAKIMX_ORDER_STATUS_LABELS[from]}" durumunda.`
  if (from === "shipped") return "Gönderilmiş sipariş değiştirilemez."
  if (from === "cancelled") return "İptal edilmiş sipariş değiştirilemez."
  return `"${BAKIMX_ORDER_STATUS_LABELS[from]}" durumundan "${BAKIMX_ORDER_STATUS_LABELS[to]}" durumuna geçilemez.`
}

/** Stoğu düşüren TEK geçiş. Yazma yolu bunu sorar, kendi `=== "shipped"`'ini yazmaz. */
export function bakimxOrderDecrementsStock(
  from: BakimxOrderStatusValue,
  to: BakimxOrderStatusValue,
): boolean {
  return to === "shipped" && from !== "shipped"
}

/** Bir sipariş hâlâ değiştirilebilir mi (terminal değil mi). */
export function isBakimxOrderOpen(status: BakimxOrderStatusValue): boolean {
  return ALLOWED_TRANSITIONS[status].length > 0
}

// ---------------------------------------------------------------------------
// Kalem anlık görüntüsü
// ---------------------------------------------------------------------------

/** Sipariş kalemine DONARAK yazılan alanlar — hepsi sunucudaki ürün kaydından. */
export interface BakimxOrderItemSnapshot {
  bakimxProductId: string
  quantity: number
  unitPriceKurus: number
  listPriceKurus: number
  discountBps: number
  nameSnapshot: string
  skuSnapshot: string
}

/**
 * Katalog ürünü + adet → sipariş kalemi.
 *
 * FİYAT İSTEMCİDEN GELMEZ (invaryant 1): `product` daima sunucuda
 * `getVisibleBakimxProduct(id, null, workshopId)` ile okunur ve
 * `displayPriceKurus` atölyenin iskontosu UYGULANMIŞ tutardır (BAK-47). İstemci
 * gövdede fiyat gönderse bile bu fonksiyonun girdisi olmadığı için kaleme geçemez
 * — kural yorumla değil, imzayla korunuyor (`bakimx-item.ts` ile aynı kalıp).
 */
export function bakimxOrderItemSnapshot(
  product: BakimxProductSummary,
  quantity: number,
): BakimxOrderItemSnapshot {
  return {
    bakimxProductId: product.id,
    quantity,
    unitPriceKurus: product.displayPriceKurus,
    listPriceKurus: product.workshopPriceKurus,
    discountBps: product.discountBps,
    nameSnapshot: product.name,
    skuSnapshot: product.sku,
  }
}

/** Siparişin KDV HARİÇ toplamı, kuruş (money.ts sözleşmesi: tam sayı aritmetiği). */
export function bakimxOrderTotalKurus(
  items: readonly { quantity: number; unitPriceKurus: number }[],
): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPriceKurus, 0)
}

/**
 * Talep edilen adet mevcut stoktan fazla mı — admin listesindeki uyarının kaynağı.
 *
 * B akışında rezervasyon YOK: iki atölye aynı 3 adetlik ürünün 3'ünü birden
 * isteyebilir ve ikisi de meşru görünür. Uyarı bu yüzden bir kapı değil bir
 * görünürlük aracıdır — sevkiyatı admin bilerek yapar.
 */
export function bakimxOrderStockShortfall(item: {
  quantity: number
  stockQty: number | null
}): number {
  if (item.stockQty == null) return 0
  return Math.max(0, item.quantity - item.stockQty)
}

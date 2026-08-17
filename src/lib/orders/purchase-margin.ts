/**
 * Alış fiyatı ↔ satış fiyatı karşılaştırması (BAK-91).
 *
 * Alış fiyatı kaydedilen kalemlerde satış fiyatı ALIŞTAN ÖN-DOLDURULUR:
 * - dış alım (`source=purchase`): teknisyenin ödediği fatura tutarı
 *   (bkz. addPurchaseItemAction → `unitPrice: purchasePriceKurus`),
 * - BakımX kalemi (`source=bakimx`): atölyenin iskontolu alış fiyatı
 *   (bkz. lib/parts/bakimx-item.ts).
 *
 * İki alan bilerek ayrıdır — atölye satışı kendi marjıyla düzenlesin diye. Ama
 * ön-doldurma sessizdir: iş emrini kapatan kişi fiyatı revize etmezse kalem
 * SIFIR MARJLA (hatta alış zamlanmışsa zararına) faturalanır. Bu modül o durumu
 * tek yerde adlandırır; arayüz rengi ve metni buradan türetir.
 *
 * Karşılaştırma DAİMA saklanan (net, KDV hariç) kuruş değerleri üzerindedir:
 * `unitPrice` net saklanır ve satırda da net gösterilir (BAK-75),
 * `purchasePriceKurus` da KDV hariçtir (bkz. prisma/schema.prisma) — iki rakam
 * aynı tabanda olduğu için doğrudan kıyaslanır. Satır toplamı (KDV DAHİL okunan
 * sütun) bu kıyasa girmez.
 *
 * Her iki fiyat da BİRİM fiyattır; miktar karşılaştırmaya girmez (iki tarafı da
 * aynı katsayıyla çarpmak sonucu değiştirmez).
 */

export type PurchaseCostItem = {
  unitPrice: number | null
  /** Alış maliyeti (kuruş, KDV hariç). Yalnız dış alım / BakımX kaleminde dolar. */
  purchasePriceKurus?: number | null
}

/**
 * - `none`      → alış fiyatı yok (ya da 0): kıyaslanacak bir maliyet yok.
 * - `unpriced`  → alış var, satış fiyatı hiç girilmemiş (teslim kapısı bunu zaten
 *                 engelliyor, bkz. pricing-guard.ts) — marj uyarısı verilmez.
 * - `below-cost`→ satış < alış: kalem ZARARINA.
 * - `at-cost`   → satış = alış: fiyat hiç revize edilmemiş, kâr yok.
 * - `marked-up` → satış > alış: normal durum.
 */
export type PurchaseMarginState = "none" | "unpriced" | "below-cost" | "at-cost" | "marked-up"

/**
 * Alış fiyatı `0` bilinçli olarak `none` sayılır: bedelsiz/garanti parçada satışın
 * da 0 olması bir hata değildir, uyarı gürültü olurdu.
 */
export function purchaseMarginState(item: PurchaseCostItem): PurchaseMarginState {
  const cost = item.purchasePriceKurus
  if (cost == null || cost <= 0) return "none"
  if (item.unitPrice == null) return "unpriced"
  if (item.unitPrice < cost) return "below-cost"
  if (item.unitPrice === cost) return "at-cost"
  return "marked-up"
}

/** Uyarı rengi hak eden durumlar: fiyat revize edilmemiş ya da zararına. */
export function needsMarkup(state: PurchaseMarginState): boolean {
  return state === "at-cost" || state === "below-cost"
}

/** Alış fiyatı satırda gösterilmeli mi (revize edildikten SONRA da görünür kalır). */
export function showsPurchaseCost(state: PurchaseMarginState): boolean {
  return state !== "none"
}

/** Birim başına kâr (kuruş); negatif olabilir. Kıyas yapılamıyorsa null. */
export function purchaseMarginKurus(item: PurchaseCostItem): number | null {
  const cost = item.purchasePriceKurus
  if (cost == null || cost <= 0 || item.unitPrice == null) return null
  return item.unitPrice - cost
}

/** Maliyet üzerine kâr yüzdesi, tam sayıya yuvarlanmış. Kıyas yapılamıyorsa null. */
export function purchaseMarginPercent(item: PurchaseCostItem): number | null {
  const margin = purchaseMarginKurus(item)
  if (margin == null) return null
  return Math.round((margin / (item.purchasePriceKurus as number)) * 100)
}

/** Satır-içi uyarı/bilgi metni (tooltip + ekran okuyucu). `none`/`unpriced` → null. */
export function purchaseMarginHint(state: PurchaseMarginState): string | null {
  switch (state) {
    case "at-cost":
      return "Satış fiyatı alış fiyatıyla aynı — kâr eklemek için birim fiyatı güncelleyin."
    case "below-cost":
      return "Satış fiyatı alış fiyatının altında — bu kalem zararına faturalanır."
    case "marked-up":
      return "Bu kalemin alış fiyatı (KDV hariç)."
    default:
      return null
  }
}

/** Fiyatı revize edilmemiş (ya da zararına) kalemler, liste sırasını koruyarak. */
export function findUnmarkedUpItems<T extends PurchaseCostItem>(items: readonly T[]): T[] {
  return items.filter((i) => needsMarkup(purchaseMarginState(i)))
}

/**
 * Liste üstündeki toplu uyarı metni. Kalem yoksa null döner — çağıran taraf
 * uyarı şeridini hiç render etmez.
 */
export function purchaseMarginNoticeMessage(items: readonly PurchaseCostItem[]): string | null {
  const flagged = findUnmarkedUpItems(items)
  if (flagged.length === 0) return null
  const below = flagged.filter((i) => purchaseMarginState(i) === "below-cost").length
  const suffix = below > 0 ? ` (${below} kalem alış fiyatının ALTINDA)` : ""
  return `${flagged.length} kalemin satış fiyatı alış fiyatını geçmiyor${suffix} — iş emrini kapatmadan önce kâr marjını girin.`
}

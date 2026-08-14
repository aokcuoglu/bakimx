import type { BakimxProductSummary } from "./bakimx-catalog"

/**
 * BakımX katalog ürünü → iş emri / teklif kalemi alanları (BAK-35).
 *
 * Saf fonksiyon ve TEK kaynak: istemci taslağı (composer) da sunucu yazımı da
 * (`addOrderItemAction`) buradan geçer. Aradaki fark girdinin nereden geldiği:
 * sunucu ürünü DB'den okuyup çağırır, dolayısıyla istemcinin gönderdiği ad ya da
 * fiyat kaleme yazılmaz.
 *
 * Üç invaryant tipin içine gömülüdür — yorumla değil, alan tipiyle korunur:
 *
 *  1. `partId: null` — o alan ATÖLYENİN kendi stok kartına bağdır ve dolu olursa
 *     sunucu stok düşer (bkz. addOrderItemAction / reserveStockInTx). BakımX
 *     stoğu atölyenin stoğu değildir; Faz 1'de rezervasyon da yoktur.
 *  2. `categoryId: null` — o kolon TecDoc kategori DÜĞÜM id'sidir. BakımX iç
 *     taksonomisinin anahtarı oraya yazılırsa kategori bazlı raporlama sahte
 *     TecDoc id'leriyle kirlenir. Kategori yalnız `category` metnine yazılır.
 *  3. `purchasePriceKurus` = ürünün `workshopPriceKurus`'u, yani atölyenin ALIŞ
 *     fiyatı (KDV hariç). `unitPrice` bundan ÖN-DOLDURULUR (dış alım kalıbı) ama
 *     ayrı bir alandır: atölye satış fiyatını kendi marjıyla düzenler. İkisini
 *     tek alana indirmek atölyeyi sıfır marjla satar duruma sokardı.
 *
 * Fiyat kalemde ANLIK GÖRÜNTÜDÜR: ürün kartı sonradan zamlanırsa geçmiş iş emri
 * satırı değişmez (bu yüzden `bakimxProductId` FK değildir, bkz. schema.prisma).
 *
 * `supplierName` / `supplierId` bilerek YOKTUR: onlar dış alım (source=purchase)
 * tedarikçi raporlamasının alanları; kaynağı `source=bakimx` + `bakimxProductId`
 * zaten belli eder.
 */
export interface BakimxLineItemFields {
  source: "bakimx"
  bakimxProductId: string
  /** Stok düşümü tetiklenmesin diye DAİMA null (invaryant 1). */
  partId: null
  /** TecDoc düğüm id'si değil (invaryant 2) — kategori `category` metninde. */
  categoryId: null
  name: string
  sku: string
  brand: string | null
  category: string | null
  unit: string
  /** Atölyenin BakımX'ten alış fiyatı — KDV hariç, kuruş. */
  purchasePriceKurus: number
  /** Alıştan ön-doldurulmuş satış fiyatı; atölye kendi marjıyla değiştirir. */
  unitPrice: number
}

export function bakimxLineItemFields(product: BakimxProductSummary): BakimxLineItemFields {
  return {
    source: "bakimx",
    bakimxProductId: product.id,
    partId: null,
    categoryId: null,
    name: product.name,
    sku: product.sku,
    brand: product.brandName || null,
    category: product.categoryLabel,
    unit: product.unit,
    purchasePriceKurus: product.workshopPriceKurus,
    unitPrice: product.workshopPriceKurus,
  }
}

/**
 * Satırın stok rozeti metni. Faz 1'de BİLGİLENDİRME: BakımX stoğu global bir
 * havuzdur, kalem eklemek rezervasyon yaratmaz — bu yüzden "0" gördüğünde bile
 * `backorderable` ürün seçilebilir kalır.
 */
export function bakimxStockLabel(product: BakimxProductSummary): string {
  if (product.stockQty > 0) return `Stok: ${product.stockQty} ${product.unit}`
  if (product.backorderable) {
    return product.leadTimeDays != null ? `Siparişe açık · ${product.leadTimeDays} gün` : "Siparişe açık"
  }
  return "Stokta yok"
}

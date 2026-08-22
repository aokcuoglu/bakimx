import type { GetirbakimProduct } from "@/lib/parts/getirbakim/types"

/**
 * GetirBakım ürünü → iş emri / teklif kalemi alanları.
 *
 * `bakimxLineItemFields` ile AYNI şekil: atölye formunda GetirBakım satırı,
 * BakımX ürünü gibi `name` / `sku` / `brand` / `category` / alış fiyatı doldurur.
 * Katalog kopyalanmaz (BAK-182) — burada yalnız o anki kartın anlık görüntüsü
 * kaleme yazılır.
 *
 * Üç invaryant:
 *  1. `partId: null` — GetirBakım stoğu atölyenin stoğu değildir; kalem eklemek
 *     stok düşmez (bkz. addOrderItemAction → reserveStockInTx).
 *  2. `categoryId: null` — o kolon TecDoc kategori DÜĞÜM id'sidir. GetirBakım
 *     kategori adı yalnız `category` metnine yazılır.
 *  3. `purchasePriceKurus` = `b2bPriceKurus` (KDV hariç alış). Liste fiyatı
 *     (`listPriceKurus`) kaleme HİÇ yazılmaz. Fiyatsız üründe ikisi de null:
 *     atölye satış fiyatını kendisi girer.
 *
 * Fiyat kalemde ANLIK GÖRÜNTÜDÜR. Sunucu yazımı ürünü GetirBakım sağlayıcısından
 * yeniden çözer; istemcinin gönderdiği ad/fiyat kaleme geçmez.
 *
 * `supplierName` / `supplierId` bilerek YOKTUR: onlar dış alım (source=purchase)
 * alanları; kaynağı `source=getirbakim` + `getirbakimProductId` belli eder.
 */
export interface GetirbakimLineItemFields {
  source: "getirbakim"
  getirbakimProductId: string
  partId: null
  categoryId: null
  name: string
  sku: string
  brand: string | null
  category: string | null
  unit: string
  purchasePriceKurus: number | null
  unitPrice: number | null
}

export function getirbakimLineItemFields(product: GetirbakimProduct): GetirbakimLineItemFields {
  const sku = product.manufacturerPartNumber?.value || product.partNo
  const price = product.b2bPriceKurus
  return {
    source: "getirbakim",
    getirbakimProductId: product.sourceProductId || product.id,
    partId: null,
    categoryId: null,
    name: product.name,
    sku,
    brand: product.brandName || null,
    category: product.categoryName,
    unit: "adet",
    purchasePriceKurus: price,
    unitPrice: price,
  }
}

export function isGetirbakimSelectable(product: GetirbakimProduct): boolean {
  return product.availability !== "UNAVAILABLE"
}

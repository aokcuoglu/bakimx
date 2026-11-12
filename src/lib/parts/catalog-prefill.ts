import type { BakimxProductSummary } from "./bakimx-catalog"
import type { GetirbakimProduct } from "./getirbakim/types"
import { getirbakimLineItemFields } from "./getirbakim-item"

/**
 * Katalog ürünü → stok kartı formu ön-doldurması (#598).
 *
 * Atölye stok kartı açarken BakımX kataloğunda / GetirBakım'da arar, uyumlu
 * ürünü seçer; ürünün KİMLİK alanları (ad, kod, OEM, marka, kategori…) forma
 * kopyalanır. Bağlantı kalıcı DEĞİLDİR: stok kartında katalog ürün id'si
 * tutulmaz, kopyalanan alanlar sonra serbestçe düzenlenir (şema değişikliği yok).
 *
 * Atölyeye özel alanlar bilerek YOKTUR: satış fiyatı, stok, kritik stok, raf,
 * tedarikçi satırları. Alış fiyatı tedarikçi BAZLIDIR (PartSupplierPrice) ve
 * hangi tedarikçiden alınacağını katalog bilemez — bu yüzden forma yazılmaz,
 * yalnız `purchasePriceKurus` olarak bilgi amaçlı gösterilir.
 *
 * Katalogda değeri olmayan alan çıktıya HİÇ girmez: atölyenin önceden yazdığı
 * bir değer boş katalog alanıyla silinmesin.
 */
export interface CatalogStockPrefillFields {
  name: string
  sku: string
  oemNo?: string
  brand?: string
  category?: string
  unit?: string
  barcode?: string
  description?: string
}

export interface CatalogStockPrefill {
  fields: CatalogStockPrefillFields
  /** Kataloğun atölyeye ALIŞ fiyatı — KDV hariç, kuruş. Fiyatsız üründe null. */
  purchasePriceKurus: number | null
  sourceLabel: "BakımX kataloğu" | "GetirBakım"
}

function present(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** Fiyatı girilmemiş katalog ürünü 0 taşıyabilir — 0 "fiyat yok" demektir. */
function positivePrice(kurus: number | null | undefined): number | null {
  return kurus != null && kurus > 0 ? kurus : null
}

function compact(fields: Record<keyof CatalogStockPrefillFields, string | undefined>): CatalogStockPrefillFields {
  const out: Partial<Record<keyof CatalogStockPrefillFields, string>> = {}
  for (const [key, value] of Object.entries(fields) as [keyof CatalogStockPrefillFields, string | undefined][]) {
    if (value !== undefined) out[key] = value
  }
  return out as CatalogStockPrefillFields
}

export function bakimxStockPrefill(product: BakimxProductSummary): CatalogStockPrefill {
  return {
    fields: compact({
      name: product.name,
      sku: product.sku,
      oemNo: present(product.oemNumbers[0]),
      brand: present(product.brandName),
      category: present(product.categoryLabel),
      unit: present(product.unit),
      barcode: present(product.barcode),
      description: present(product.description),
    }),
    // İskontolu alış (BAK-47/BAK-58) — liste fiyatı atölye yüzeyine çıkmaz.
    purchasePriceKurus: positivePrice(product.displayPriceKurus),
    sourceLabel: "BakımX kataloğu",
  }
}

export function getirbakimStockPrefill(product: GetirbakimProduct): CatalogStockPrefill {
  // Kod/marka/kategori seçimi kalem yoluyla aynı olsun diye tek eşleyiciden.
  const line = getirbakimLineItemFields(product)
  return {
    fields: compact({
      name: line.name,
      sku: line.sku,
      oemNo: present(product.oemNumbers[0]),
      brand: present(line.brand),
      category: present(line.category),
      unit: undefined,
      barcode: undefined,
      description: undefined,
    }),
    purchasePriceKurus: positivePrice(line.purchasePriceKurus),
    sourceLabel: "GetirBakım",
  }
}

/** Ön-doldurmayı forma yazar; yalnız `fields` içindeki alanlara dokunur. */
export function applyCatalogPrefill(
  prefill: CatalogStockPrefill,
  setValue: (name: keyof CatalogStockPrefillFields, value: string) => void,
): void {
  for (const [key, value] of Object.entries(prefill.fields) as [keyof CatalogStockPrefillFields, string | undefined][]) {
    if (value !== undefined) setValue(key, value)
  }
}

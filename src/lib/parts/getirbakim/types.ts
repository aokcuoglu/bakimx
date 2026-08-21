/**
 * GetirBakım partner API'sinin BakımX tarafındaki karşılığı (BAK-183).
 *
 * GetirBakım tek ticari/stok/sevkiyat katmanıdır; BakımX B2B ön yüzüdür ve
 * katalogu KOPYALAMAZ — burada tanımlı olan yalnız okunan alanların şeklidir.
 * Alan adları GetirBakım `app/api/partner/v1/*` sözleşmesiyle birebirdir;
 * sözleşme değişirse tek düzeltilecek yer {@link parseGetirbakimProduct}.
 */

/** Ürünün tedarik durumu — GetirBakım `CatalogAvailability` ile aynı. */
export type GetirbakimAvailability = "IN_STOCK" | "SUPPLYABLE" | "UNAVAILABLE"

export interface GetirbakimProduct {
  id: string
  partNo: string
  name: string
  brandName: string
  categoryName: string | null
  oemNumbers: string[]
  imageUrl: string | null
  /** GetirBakım vitrin fiyatı — KDV hariç, kuruş. Fiyatsız üründe null. */
  listPriceKurus: number | null
  /** Atölyenin ALIŞ fiyatı — KDV hariç, kuruş. Yüzeyde gösterilen budur. */
  b2bPriceKurus: number | null
  /** `listPriceKurus` → `b2bPriceKurus` arasındaki oran (bps; 1500 = %15). */
  discountBps: number
  /** `b2bPriceKurus` üzerine uygulanacak KDV oranı (bps; 2000 = %20). */
  vatRateBps: number
  currency: string
  stockQty: number
  availability: GetirbakimAvailability
  /**
   * Stok/fiyatın GetirBakım'da en son tazelendiği an (ISO-8601) ya da null.
   *
   * YÜZEYDE GÖSTERİLMESİ ZORUNLU (BAK-183): bu veri GetirBakım'ın tedarikçi
   * sync aralığı kadar bayattır ve "anlık stok" VAAT EDİLMEZ. Alanı gizlemek,
   * atölyeye tutamayacağımız bir söz vermek olur.
   */
  lastSyncedAt: string | null
}

export interface GetirbakimSearchInput {
  /** Serbest metin sorgusu. */
  q?: string | null
  /** OEM/parça kodu — verildiğinde tam eşleşme aranır, `q` yok sayılır. */
  oem?: string | null
  limit?: number | null
}

export type GetirbakimOfferAvailability = "IN_STOCK" | "SUPPLYABLE" | "UNKNOWN"

export interface GetirbakimOffer {
  supplierDisplayName: string
  informationalPriceKurus: number | null
  currency: string
  vatRateBps: number
  availability: GetirbakimOfferAvailability
  stockQty: number | null
  lastSyncedAt: string | null
}

export interface GetirbakimExactProduct {
  sourceProductId: string
  brandName: string
  manufacturerPartNumber: { value: string; normalized: string }
  offers: GetirbakimOffer[]
}

export type GetirbakimExactOfferResult =
  | { status: "matched"; products: GetirbakimExactProduct[] }
  | { status: "no_match" }

export type GetirbakimOfferLookupStatus = "matched" | "no_offers" | "no_match"

export function classifyExactProducts(products: GetirbakimExactProduct[]): GetirbakimOfferLookupStatus {
  if (products.length === 0) return "no_match"
  return products.some((product) => product.offers.length > 0) ? "matched" : "no_offers"
}

export type GetirbakimProviderName = "mock" | "http"

export interface GetirbakimProvider {
  readonly name: GetirbakimProviderName
  /**
   * Sonuç döndürür ya da BOŞ liste. Sağlayıcı HATA FIRLATMAZ: GetirBakım
   * BakımX'in çalışması için zorunlu değil, ek bir kaynak. Dış servis düştüğünde
   * atölyenin parça arama akışı da düşmemeli — bkz. http sağlayıcısındaki düşüş.
   */
  search(input: GetirbakimSearchInput): Promise<GetirbakimProduct[]>
  /** Exact parça numarası sorgusu. Upstream hatasında fırlatır; route bunu ayırır. */
  findOffersByPartNo(partNo: string): Promise<GetirbakimExactOfferResult>
}

/** Sunucuda kırpılan sonuç sayısı — istemci daha büyüğünü isteyemez. */
export const GETIRBAKIM_DEFAULT_LIMIT = 10
export const GETIRBAKIM_MAX_LIMIT = 25

/** Satır içi aramayla aynı eşik: 2 karakterden kısa sorgu dışarı çıkmaz. */
export const GETIRBAKIM_MIN_SEARCH_LEN = 2

export function clampGetirbakimLimit(limit: number | null | undefined): number {
  if (limit == null || !Number.isFinite(limit) || limit <= 0) return GETIRBAKIM_DEFAULT_LIMIT
  return Math.min(Math.floor(limit), GETIRBAKIM_MAX_LIMIT)
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null
}

function asInt(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : null
}

export function normalizePartNo(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "")
}

export function parseGetirbakimOffer(raw: unknown): GetirbakimOffer | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const supplierDisplayName = asString(row.supplierDisplayName)
  if (!supplierDisplayName) return null
  const availability = row.availability
  return {
    supplierDisplayName,
    informationalPriceKurus: asInt(row.informationalPriceKurus),
    currency: asString(row.currency) ?? "TRY",
    vatRateBps: asInt(row.vatRateBps) ?? 2000,
    availability:
      availability === "IN_STOCK" || availability === "SUPPLYABLE" ? availability : "UNKNOWN",
    stockQty: row.stockQty == null ? null : Math.max(asInt(row.stockQty) ?? 0, 0),
    lastSyncedAt: asString(row.lastSyncedAt),
  }
}

export function parseGetirbakimExactProduct(raw: unknown): GetirbakimExactProduct | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const sourceProductId = asString(row.sourceProductId)
  const number = row.manufacturerPartNumber
  if (!sourceProductId || !number || typeof number !== "object") return null
  const numberRow = number as Record<string, unknown>
  const value = asString(numberRow.value)
  const normalized = asString(numberRow.normalized)
  if (!value || !normalized) return null
  const offers = Array.isArray(row.offers)
    ? row.offers.map(parseGetirbakimOffer).filter((offer): offer is GetirbakimOffer => offer !== null)
    : []
  return {
    sourceProductId,
    brandName: asString(row.brandName) ?? "",
    manufacturerPartNumber: { value, normalized },
    offers,
  }
}

function asAvailability(value: unknown): GetirbakimAvailability {
  return value === "IN_STOCK" || value === "SUPPLYABLE" ? value : "UNAVAILABLE"
}

/**
 * Dış gövdeyi DTO'ya çevirir; zorunlu alanı eksik olan satır `null` döner ve
 * çağıran tarafından atılır.
 *
 * Dış servisin gövdesine GÜVENİLMEZ: `id`/`name` gibi alanlar doğrulanmadan
 * yüzeye taşınırsa, sözleşme değiştiğinde hata arama ekranında `undefined`
 * olarak görünür. Burada düşürmek, orada bozuk satır göstermekten iyidir.
 */
export function parseGetirbakimProduct(raw: unknown): GetirbakimProduct | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>

  const id = asString(row.id)
  const name = asString(row.name)
  if (!id || !name) return null

  const oemNumbers = Array.isArray(row.oemNumbers)
    ? row.oemNumbers.filter((code): code is string => typeof code === "string")
    : []

  return {
    id,
    partNo: asString(row.partNo) ?? "",
    name,
    brandName: asString(row.brandName) ?? "",
    categoryName: asString(row.categoryName),
    oemNumbers,
    imageUrl: asString(row.imageUrl),
    listPriceKurus: asInt(row.listPriceKurus),
    b2bPriceKurus: asInt(row.b2bPriceKurus),
    discountBps: asInt(row.discountBps) ?? 0,
    vatRateBps: asInt(row.vatRateBps) ?? 2000,
    currency: asString(row.currency) ?? "TRY",
    stockQty: Math.max(asInt(row.stockQty) ?? 0, 0),
    availability: asAvailability(row.availability),
    lastSyncedAt: asString(row.lastSyncedAt),
  }
}

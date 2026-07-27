/** Fixed TecDoc params for BakımX (user decision): passenger cars, Turkish. */
export const TYPE_ID = 1
export const LANG_ID = 23
/**
 * Türkiye (probe 2026-07-26: GET /countries/list-countries-by-lang-id/23 →
 * {id: 255, couCode: "TR"}). Yalnız parça DETAY ucu ülke filtresi ister;
 * kategori/parça listesi uçları istemez (bkz. schemas.ts probe notları).
 * Aynı parçada 255 → 369, 1 → 378 uyumlu araç döndü: TR filtresi Türkiye'de
 * satılmayan varyantları eler. Eksik kalan araçlar için uyumluluk yine yerel
 * `tecdoc_articles` linkage'ına düşer (bkz. getArticleCompatibility).
 */
export const COUNTRY_FILTER_ID = 255

export type TecdocErrorCode = "config_error" | "provider_error" | "quota_exceeded" | "invalid_params"

export class TecdocError extends Error {
  readonly code: TecdocErrorCode
  constructor(code: TecdocErrorCode, message: string) {
    super(message)
    this.name = "TecdocError"
    this.code = code
  }
}

/** Normalized category tree node the UI drills through. */
export interface CategoryNode {
  id: number
  name: string
  children: CategoryNode[]
}

/** Düzleştirilmiş yaprak kategori — Combobox listesini doldurur. `path` üst kategori yolu (" › " ayraçlı, yaprağın adı hariç). */
export interface CategoryLeaf {
  id: number
  name: string
  path: string
}

/**
 * Kategori arama sonucu — parça seçicinin "KATEGORİLER" bölümünü doldurur.
 * `ancestors` kökten düğüme giden üst düğümler (düğümün kendisi hariç); seçilince
 * breadcrumb yığını buradan yeniden kurulur, böylece "geri" doğru üst kategoriye
 * döner. `path` aynı yolun görüntülenecek metni (" / " ayraçlı, kökte "").
 */
export interface CategoryMatch {
  node: CategoryNode
  ancestors: CategoryNode[]
  path: string
}

/** Normalized article row shown in the picker. */
export interface ArticleSummary {
  tecdocArticleId: number
  articleNo: string
  productName: string
  supplierName: string
  supplierId: number | null
  /** Product photo (webp on the provider's S3) — may be null. */
  imageUrl: string | null
}

/** Tek teknik özellik satırı — "Dış çap [mm]" / "68". */
export interface ArticleSpec {
  name: string
  value: string
}

/** OEM referans numarası — "HONDA" / "15400-PLM-A02". */
export interface ArticleOem {
  brand: string
  number: string
}

/** Parçanın uyduğu bir araç varyantı (compatibleCars kaydı). */
export interface ArticleFitment {
  vehicleId: number
  manufacturerName: string
  modelName: string
  typeEngineName: string
  /** ISO tarih ("2016-09-01") ya da null — üretim aralığı. */
  constructionIntervalStart: string | null
  constructionIntervalEnd: string | null
}

/**
 * Parça detayı — GET /articles/article-complete-details tek çağrısından çıkar
 * (probe 2026-07-26: özellikler + OEM + EAN + görsel + uyumlu araçlar hepsi
 * burada; ayrı specs/media uçlarına gerek yok, medya ucu zaten tek görsel
 * döndürüyor).
 */
export interface ArticleDetail {
  tecdocArticleId: number
  articleNo: string
  productName: string
  supplierName: string
  supplierId: number | null
  imageUrl: string | null
  specs: ArticleSpec[]
  oems: ArticleOem[]
  eanNumbers: string[]
  /**
   * SUNUCU-İÇİ: 300+ kayıt olabiliyor, istemciye GÖNDERİLMEZ — yalnız aracın
   * eşleşen kaydını bulmak için kullanılır (bkz. ArticleDetailPublic).
   */
  compatibleCars: ArticleFitment[]
}

/** İstemciye giden detay — ağır `compatibleCars` listesi çıkarılmış hâli. */
export type ArticleDetailPublic = Omit<ArticleDetail, "compatibleCars">

/**
 * `linked`  → parça bu araca uyuyor (TecDoc uyumlu-araç listesinde VEYA yerel
 *             katalog linkage'ında var).
 * `unknown` → doğrulanamadı. "Uygun değil" DEĞİLDİR: yerel katalog kapsamı
 *             best-effort, TR ülke filtresi de bazı varyantları eler.
 */
export type CompatibilityStatus = "linked" | "unknown"

export interface ArticleCompatibility {
  status: CompatibilityStatus
  /** Eşleşen araç kaydı — "neden uygun" sorusunun cevabı (motor + üretim aralığı). */
  fitment: ArticleFitment | null
}

/** Muadil / çapraz referans kaydı. */
export interface ArticleCrossRef {
  tecdocArticleId: number | null
  articleNo: string
  supplierName: string
  productName: string
  imageUrl: string | null
}

/** Normalized parça markası (TecDoc supplier) — Marka Combobox'ını doldurur. */
export interface PartBrandSummary {
  /** TecDoc supplierId — parça markasının katalog kimliği. */
  supplierId: number
  /** Marka adı (BOSCH, MAHLE, MANN-FILTER...). */
  name: string
}

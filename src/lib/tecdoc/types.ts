/** Fixed TecDoc params for BakımX (user decision): passenger cars, Turkish. */
export const TYPE_ID = 1
export const LANG_ID = 23

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

/** Normalized parça markası (TecDoc supplier) — Marka Combobox'ını doldurur. */
export interface PartBrandSummary {
  /** TecDoc supplierId — parça markasının katalog kimliği. */
  supplierId: number
  /** Marka adı (BOSCH, MAHLE, MANN-FILTER...). */
  name: string
}

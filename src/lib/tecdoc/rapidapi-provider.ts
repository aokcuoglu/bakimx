import { TecdocError, TYPE_ID, LANG_ID, COUNTRY_FILTER_ID } from "./types"
import type { TecdocProvider } from "./provider"

const RAPIDAPI_HOST = "auto-parts-catalog.p.rapidapi.com"
const DEFAULT_TIMEOUT_MS = 15_000

/** TecDoc catalog via RapidAPI (same paid subscription as the VIN lookup —
 *  always go through catalog.ts which is cache-first; never call directly). */
export class RapidApiTecdocProvider implements TecdocProvider {
  readonly name = "rapidapi"

  constructor(private readonly apiKey: string) {}

  private async get(path: string): Promise<unknown> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

    let res: Response
    try {
      res = await fetch(`https://${RAPIDAPI_HOST}${path}`, {
        headers: {
          "x-rapidapi-key": this.apiKey,
          "x-rapidapi-host": RAPIDAPI_HOST,
          accept: "application/json",
        },
        signal: controller.signal,
        cache: "no-store",
      })
    } catch (err) {
      throw new TecdocError(
        "provider_error",
        `Parça kataloğu servisine ulaşılamadı: ${err instanceof Error ? err.message : "ağ hatası"}`
      )
    } finally {
      clearTimeout(timeout)
    }

    if (res.status === 429) {
      throw new TecdocError("quota_exceeded", "Parça kataloğu servisi istek limitine ulaştı (RapidAPI 429).")
    }
    if (!res.ok) {
      throw new TecdocError("provider_error", `Parça kataloğu servisi hata döndürdü (HTTP ${res.status}).`)
    }

    try {
      return await res.json()
    } catch {
      throw new TecdocError("provider_error", "Parça kataloğu servisi geçersiz yanıt döndürdü (JSON değil).")
    }
  }

  getCategories(vehicleId: number): Promise<unknown> {
    // variant-2 = hierarchical tree with Turkish names (probed 2026-07-02)
    return this.get(`/category/type-id/${TYPE_ID}/products-groups-variant-2/${vehicleId}/lang-id/${LANG_ID}`)
  }

  getArticles(vehicleId: number, categoryId: number): Promise<unknown> {
    // GET legacy path form — the POST /articles/list-articles variant returns
    // all-null fields on this provider (probed with both string and int ids).
    return this.get(`/articles/list/type-id/${TYPE_ID}/vehicle-id/${vehicleId}/category-id/${categoryId}/lang-id/${LANG_ID}`)
  }

  getSuppliers(): Promise<unknown> {
    // GET /suppliers/list — araç-bağımsız tüm parça markaları (supplierId +
    // supplierName). Probed 2026-07-02: 1264 öğe top-level array döner.
    return this.get(`/suppliers/list`)
  }

  getArticleDetail(articleId: number): Promise<unknown> {
    // Probed 2026-07-26 (scripts/probe-tecdoc-article.ts): bu TEK çağrı
    // özellikleri, OEM numaralarını, EAN'ı, görseli ve uyumlu araç listesini
    // birlikte döndürüyor. Ayrı `/articles/details`, `.../specifications-
    // criterias` ve `article-all-media-info` uçları bunun alt kümesi — kota
    // harcamamak için kullanılmıyor.
    return this.get(
      `/articles/article-complete-details/type-id/${TYPE_ID}?articleId=${articleId}&countryFilterId=${COUNTRY_FILTER_ID}&langId=${LANG_ID}`
    )
  }

  getArticleCrossRefs(articleId: number): Promise<unknown> {
    // Probed 2026-07-26: {countArticles, articles[]} — 156 muadil, 43 marka.
    return this.get(`/artlookup/select-article-cross-references/article-id/${articleId}/lang-id/${LANG_ID}`)
  }
}

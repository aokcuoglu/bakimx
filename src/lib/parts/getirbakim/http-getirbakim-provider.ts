import {
  clampGetirbakimLimit,
  parseGetirbakimProduct,
  type GetirbakimProduct,
  type GetirbakimProvider,
  type GetirbakimSearchInput,
} from "./types"

/**
 * Gerçek GetirBakım partner API'si (BAK-183) — `GET {baseUrl}/api/partner/v1/products`.
 *
 * DÜŞÜŞ SÖZLEŞMESİ: bu sınıf HİÇBİR KOŞULDA fırlatmaz, en kötü ihtimalle boş
 * liste döner. GetirBakım BakımX'in çalışması için zorunlu değil, ek bir
 * kaynaktır: dış servis yavaşladığında ya da düştüğünde atölyenin TecDoc + kendi
 * kataloğu üzerinden yürüyen parça arama akışı da düşerse, hiç entegre
 * etmemekten kötü bir durum yaratmış oluruz.
 *
 * Zaman aşımı `AbortSignal.timeout` ile ZORUNLU: zamanaşımsız bir `fetch`,
 * cevap vermeyen bir sunucuda atölyenin arama isteğini süresiz askıda tutardı.
 */

export const GETIRBAKIM_DEFAULT_TIMEOUT_MS = 4000

export class HttpGetirbakimProvider implements GetirbakimProvider {
  readonly name = "http" as const

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs: number = GETIRBAKIM_DEFAULT_TIMEOUT_MS,
  ) {}

  private url(input: GetirbakimSearchInput): string {
    const params = new URLSearchParams()
    const oem = input.oem?.trim()
    if (oem) params.set("oem", oem)
    else if (input.q?.trim()) params.set("q", input.q.trim())
    params.set("limit", String(clampGetirbakimLimit(input.limit)))
    return `${this.baseUrl.replace(/\/+$/, "")}/api/partner/v1/products?${params.toString()}`
  }

  async search(input: GetirbakimSearchInput): Promise<GetirbakimProduct[]> {
    if (!input.oem?.trim() && !input.q?.trim()) return []

    try {
      const res = await fetch(this.url(input), {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(this.timeoutMs),
        // Katalog kopyalanmaz; tazelik bizim kısa TTL cache'imizle yönetilir.
        cache: "no-store",
      })

      if (!res.ok) {
        // Anahtar/kota/sunucu hatası: SESSİZ boş liste. Gövdeyi loga yazmıyoruz,
        // içinde partner anahtarı yankılanmış olabilir.
        console.error(`[getirbakim/http] arama başarısız: HTTP ${res.status}`)
        return []
      }

      const body = (await res.json()) as Record<string, unknown>
      const products = body?.products
      if (!Array.isArray(products)) return []

      return products
        .map(parseGetirbakimProduct)
        .filter((p): p is GetirbakimProduct => p !== null)
    } catch (err) {
      // Zaman aşımı (TimeoutError), ağ hatası, bozuk JSON — hepsi aynı kapıya
      // çıkar: GetirBakım bu sorgu için yok sayılır.
      console.error(
        "[getirbakim/http] arama düştü:",
        err instanceof Error ? err.message : err,
      )
      return []
    }
  }
}

import { VinLookupError, extractMatchSections } from "./types"
import type { VinProvider, VinProviderResult } from "./provider"

const RAPIDAPI_HOST = "auto-parts-catalog.p.rapidapi.com"
const DEFAULT_TIMEOUT_MS = 15_000

/** TecDoc VIN check via RapidAPI (paid: ~20k requests/month — always go through
 *  lookupVin() which is cache-first; never call this directly from routes). */
export class RapidApiVinProvider implements VinProvider {
  readonly name = "rapidapi"

  constructor(private readonly apiKey: string) {}

  async lookup(vin: string): Promise<VinProviderResult> {
    const url = `https://${RAPIDAPI_HOST}/vin/tecdoc-vin-check/${encodeURIComponent(vin)}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

    let res: Response
    try {
      res = await fetch(url, {
        headers: {
          "x-rapidapi-key": this.apiKey,
          "x-rapidapi-host": RAPIDAPI_HOST,
        },
        signal: controller.signal,
        cache: "no-store",
      })
    } catch (err) {
      throw new VinLookupError(
        "provider_error",
        `VIN sorgulama servisine ulaşılamadı: ${err instanceof Error ? err.message : "ağ hatası"}`
      )
    } finally {
      clearTimeout(timeout)
    }

    if (res.status === 404) return { status: "not_found", raw: null }
    if (res.status === 429) {
      throw new VinLookupError("quota_exceeded", "VIN sorgulama servisi istek limitine ulaştı (RapidAPI 429).")
    }
    if (!res.ok) {
      throw new VinLookupError("provider_error", `VIN sorgulama servisi hata döndürdü (HTTP ${res.status}).`)
    }

    let raw: unknown
    try {
      raw = await res.json()
    } catch {
      throw new VinLookupError("provider_error", "VIN sorgulama servisi geçersiz yanıt döndürdü (JSON değil).")
    }

    const sections = extractMatchSections(raw)
    if (!sections || sections.matchingVehicles.length === 0) {
      // A well-formed "no match" answer is a terminal fact worth caching.
      return { status: "not_found", raw }
    }
    return { status: "found", raw }
  }
}

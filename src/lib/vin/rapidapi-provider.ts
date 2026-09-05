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
        `Şase sorgulama servisine ulaşılamadı: ${err instanceof Error ? err.message : "ağ hatası"}`
      )
    } finally {
      clearTimeout(timeout)
    }

    if (res.status === 404) return { status: "not_found", raw: null }
    if (res.status === 429) {
      throw new VinLookupError("quota_exceeded", "Şase sorgulama servisi istek limitine ulaştı. Lütfen daha sonra tekrar deneyin.")
    }
    if (!res.ok) {
      throw new VinLookupError("provider_error", `Şase sorgulama servisi hata döndürdü (HTTP ${res.status}).`)
    }

    let raw: unknown
    try {
      raw = await res.json()
    } catch {
      throw new VinLookupError("provider_error", "Şase sorgulama servisi geçersiz yanıt döndürdü.")
    }

    const sections = extractMatchSections(raw)
    // A manufacturer/model hit without an exact vehicle-level row is still a
    // match — resolveVinToCatalog() falls back to brand/model in that case.
    // Only cache "not_found" when NOTHING at all was recognized; otherwise a
    // recognized-but-variant-less VIN would be miscached as a terminal miss
    // and permanently skip that fallback (vin_lookups has no TTL).
    const hasAnyMatch =
      !!sections &&
      (sections.matchingVehicles.length > 0 ||
        sections.matchingModels.length > 0 ||
        sections.matchingManufacturers.length > 0)
    if (!hasAnyMatch) {
      return { status: "not_found", raw }
    }
    return { status: "found", raw }
  }
}

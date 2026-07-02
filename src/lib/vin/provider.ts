import { VinLookupError } from "./types"
import { MockVinProvider } from "./mock-provider"
import { RapidApiVinProvider } from "./rapidapi-provider"

export interface VinProviderResult {
  status: "found" | "not_found"
  /** Raw provider payload — persisted verbatim to the cache. Null for not_found. */
  raw: unknown
}

export interface VinProvider {
  readonly name: string
  /** Throws VinLookupError("provider_error") on transport/HTTP failures. */
  lookup(vin: string): Promise<VinProviderResult>
}

let _provider: VinProvider | null = null

export function getVinProvider(): VinProvider {
  if (_provider) return _provider

  const name = (process.env.VIN_PROVIDER || "mock").toLowerCase().trim()

  if (name === "mock" || name === "") {
    _provider = new MockVinProvider()
    return _provider
  }

  if (name === "rapidapi") {
    const apiKey = process.env.RAPIDAPI_KEY
    if (!apiKey) {
      throw new VinLookupError(
        "config_error",
        "VIN sorgulama için RAPIDAPI_KEY tanımlanmalıdır. " +
          "Demo verisi kullanmak için VIN_PROVIDER=mock (veya boş) ayarlayabilirsiniz."
      )
    }
    _provider = new RapidApiVinProvider(apiKey)
    return _provider
  }

  throw new VinLookupError(
    "config_error",
    `Bilinmeyen VIN sağlayıcısı: "${name}". Desteklenen değerler: mock (varsayılan), rapidapi.`
  )
}

export function resetVinProvider(): void {
  _provider = null
}

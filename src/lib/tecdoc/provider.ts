import { TecdocError } from "./types"
import { MockTecdocProvider } from "./mock-provider"
import { RapidApiTecdocProvider } from "./rapidapi-provider"

/** Raw payloads only — normalization happens in catalog.ts on read. */
export interface TecdocProvider {
  readonly name: string
  getCategories(vehicleId: number): Promise<unknown>
  getArticles(vehicleId: number, categoryId: number): Promise<unknown>
  getSuppliers(): Promise<unknown>
}

let _provider: TecdocProvider | null = null

export function getTecdocProvider(): TecdocProvider {
  if (_provider) return _provider

  const name = (process.env.TECDOC_PROVIDER || "mock").toLowerCase().trim()

  if (name === "mock" || name === "") {
    _provider = new MockTecdocProvider()
    return _provider
  }

  if (name === "rapidapi") {
    const apiKey = process.env.RAPIDAPI_KEY
    if (!apiKey) {
      throw new TecdocError(
        "config_error",
        "Parça kataloğu için RAPIDAPI_KEY tanımlanmalıdır. " +
          "Demo verisi kullanmak için TECDOC_PROVIDER=mock (veya boş) ayarlayabilirsiniz."
      )
    }
    _provider = new RapidApiTecdocProvider(apiKey)
    return _provider
  }

  throw new TecdocError(
    "config_error",
    `Bilinmeyen parça kataloğu sağlayıcısı: "${name}". Desteklenen değerler: mock (varsayılan), rapidapi.`
  )
}

export function resetTecdocProvider(): void {
  _provider = null
}

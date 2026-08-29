import "client-only"

import { importLibrary, setOptions, type LibraryMap } from "@googlemaps/js-api-loader"
import type { GoogleMapsSku } from "@/lib/sales/google-maps-quota"

let configuredKey: string | null = null
let configuredMapId: string | null = null

export class GoogleMapsCostGuardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GoogleMapsCostGuardError"
  }
}

/**
 * Her billable Google işleminin ön kapısı. Ağ/sayaç hatası dahil başarılı bir
 * rezervasyon dönmeyen hiçbir durumda çağıran Google'a devam etmez.
 */
export async function reserveSalesGoogleMapsUsage(sku: GoogleMapsSku): Promise<void> {
  let response: Response
  let payload: { allowed?: boolean } | null = null
  try {
    response = await fetch("/api/admin/sales/google-maps-usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku }),
      cache: "no-store",
    })
    payload = await response.json().catch(() => null)
  } catch {
    throw new GoogleMapsCostGuardError(
      "Maliyet sayacı doğrulanamadığı için Google Maps geçici olarak durduruldu.",
    )
  }

  // Oturum süresi dolduğunda Next yönlendirmesi HTML + 200 dönebilir. Yalnız
  // açık `allowed: true` sözleşmesi Google çağrısına geçebilir.
  if (response.ok && payload?.allowed === true) return

  if (response.status === 429) {
    throw new GoogleMapsCostGuardError(
      "Ücretsiz Google Maps kullanım sınırına ulaşıldı; ücret oluşmaması için özellik ay sonuna kadar durduruldu.",
    )
  }

  throw new GoogleMapsCostGuardError(
    "Maliyet koruması doğrulanamadığı için Google Maps geçici olarak durduruldu.",
  )
}

export function googleMapsClientErrorMessage(error: unknown, fallback: string): string {
  return error instanceof GoogleMapsCostGuardError ? error.message : fallback
}

function configureGoogleMaps(apiKey: string, mapId: string) {
  if (configuredKey && (configuredKey !== apiKey || configuredMapId !== mapId)) {
    throw new Error("Google Maps bu sayfada farklı bir yapılandırmayla zaten başlatıldı.")
  }
  if (configuredKey) return

  setOptions({
    key: apiKey,
    v: "weekly",
    language: "tr",
    region: "TR",
    authReferrerPolicy: "origin",
    mapIds: [mapId],
  })
  configuredKey = apiKey
  configuredMapId = mapId
}

export function loadSalesGoogleLibrary<TName extends keyof LibraryMap>(
  apiKey: string,
  mapId: string,
  name: TName,
): Promise<LibraryMap[TName]> {
  configureGoogleMaps(apiKey, mapId)
  return importLibrary(name)
}

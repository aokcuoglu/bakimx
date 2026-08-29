import "client-only"

import { importLibrary, setOptions, type LibraryMap } from "@googlemaps/js-api-loader"

let configuredKey: string | null = null
let configuredMapId: string | null = null

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

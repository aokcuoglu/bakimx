/**
 * Araç fotoğrafından okunan marka adını atölye kataloğundaki (VehicleBrand)
 * yazımına çevirir. Model "Mercedes-Benz", "VW", "citroën" gibi yazabilir;
 * katalogda karşılığı bulunursa o yazım döner ki marka seçici kataloğu tanısın
 * ve modelleri yüklesin. Karşılık yoksa okunan ad olduğu gibi kullanılır —
 * marka alanı serbest metin kabul ediyor.
 */

/** Yaygın kısaltma/yazım farkları → katalogdaki adın normal biçimi. */
const ALIASES: Record<string, string> = {
  vw: "volkswagen",
  mercedesbenz: "mercedes",
  mb: "mercedes",
  chevy: "chevrolet",
  alfa: "alfaromeo",
}

/** Karşılaştırma anahtarı: küçük harf, aksan ve harf/rakam dışı karakterler atılır. */
export function brandKey(name: string): string {
  return name
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "")
}

export function matchCatalogBrand(raw: string, catalog: readonly string[]): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const key = brandKey(trimmed)
  if (!key) return null

  const byKey = new Map(catalog.map((name) => [brandKey(name), name]))
  const exact = byKey.get(key) ?? byKey.get(ALIASES[key] ?? "")
  if (exact) return exact

  // "mercedesbenz" ↔ katalogda "Mercedes-Benz" yerine "Mercedes": en uzun ön ek kazanır.
  let best: string | null = null
  let bestLen = 0
  for (const [k, name] of byKey) {
    if (k.length < 3 || key.length < 3) continue
    if ((key.startsWith(k) || k.startsWith(key)) && k.length > bestLen) {
      best = name
      bestLen = k.length
    }
  }
  return best ?? trimmed
}

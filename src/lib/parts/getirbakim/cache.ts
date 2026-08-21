import type { GetirbakimProduct } from "./types"

/**
 * Kısa ömürlü sonuç belleği (BAK-183).
 *
 * NEDEN VAR: atölye arama kutusunda yazarken aynı sorgu birden çok kez sunucuya
 * düşüyor (satır içi tamamlama + parça seçici aynı terimi sorabiliyor). Cache
 * olmadan her tuş vuruşu GetirBakım'a bir dış çağrı olurdu.
 *
 * NEDEN KISA: TTL bilinçli olarak dakikalar değil SANİYELER. Bu bir katalog
 * kopyası DEĞİL — stok ve fiyat GetirBakım'da anlık değişebilir; uzun TTL,
 * atölyeye artık geçerli olmayan bir fiyat göstermek demektir. Katalog
 * kopyalanmaz kararının (BAK-182) teknik karşılığı budur.
 */

export const GETIRBAKIM_CACHE_TTL_MS = 60_000

/** Bellek sınırı: tek bir atölyenin tarama yapıp süreç belleğini şişirmemesi için. */
export const GETIRBAKIM_CACHE_MAX_ENTRIES = 200

interface CacheEntry {
  expiresAt: number
  products: GetirbakimProduct[]
}

const store = new Map<string, CacheEntry>()

export function getirbakimCacheKey(input: {
  q?: string | null
  oem?: string | null
  limit: number
  vehicleTypeId?: number | null
}): string {
  const oem = input.oem?.trim().toUpperCase() ?? ""
  const q = input.q?.trim().toLocaleLowerCase("tr") ?? ""
  return `${oem}|${q}|${input.limit}|${input.vehicleTypeId ?? ""}`
}

export function readGetirbakimCache(
  key: string,
  now: number = Date.now(),
): GetirbakimProduct[] | null {
  const entry = store.get(key)
  if (!entry) return null
  if (entry.expiresAt <= now) {
    store.delete(key)
    return null
  }
  return entry.products
}

export function writeGetirbakimCache(
  key: string,
  products: GetirbakimProduct[],
  now: number = Date.now(),
): void {
  // Sınıra gelindiğinde en eski giriş atılır (Map ekleme sırasını korur).
  if (store.size >= GETIRBAKIM_CACHE_MAX_ENTRIES && !store.has(key)) {
    const oldest = store.keys().next()
    if (!oldest.done) store.delete(oldest.value)
  }
  store.set(key, { expiresAt: now + GETIRBAKIM_CACHE_TTL_MS, products })
}

/** Yalnız test içindir. */
export function resetGetirbakimCache(): void {
  store.clear()
}

import "server-only"
import {
  getirbakimCacheKey,
  readGetirbakimCache,
  writeGetirbakimCache,
} from "./cache"
import { getGetirbakimProvider } from "./provider"
import {
  clampGetirbakimLimit,
  GETIRBAKIM_MAX_LIMIT,
  GETIRBAKIM_MIN_SEARCH_LEN,
  type GetirbakimProduct,
  type GetirbakimSearchInput,
} from "./types"

/**
 * Sunucu tarafı GetirBakım araması (BAK-183) — sağlayıcı seçimi + kısa TTL cache.
 *
 * FİYAT VE STOK YALNIZ BURADAN GELİR. İstemci bir fiyat GÖNDEREMEZ ve gönderdiği
 * hiçbir değer bu yola girmez: uçtan yalnız arama terimi ve limit okunur. Aksi
 * hâlde atölye yüzeyinden gelen bir sayı, kaleme yazılan alış fiyatı olurdu.
 */
export async function searchGetirbakimProducts(
  input: GetirbakimSearchInput,
): Promise<GetirbakimProduct[]> {
  const limit = clampGetirbakimLimit(input.limit)
  const oem = input.oem?.trim() || null
  const q = input.q?.trim() || null
  const vehicleTypeId = input.vehicleTypeId ?? null

  // Eşik altı serbest metin dışarı ÇIKMAZ. OEM sorgusu eşiğe tabi değil: kısa
  // ama geçerli parça kodları var ("OC90"), onları kesmek aramayı bozardı.
  if (!oem && (!q || q.length < GETIRBAKIM_MIN_SEARCH_LEN)) return []

  const key = getirbakimCacheKey({ q, oem, limit, vehicleTypeId })
  const cached = readGetirbakimCache(key)
  if (cached) return cached

  const products = await getGetirbakimProvider().search({ q, oem, limit, vehicleTypeId })

  // Boş sonuç da yazılır: "bu terim GetirBakım'da yok" bilgisi de tekrar tekrar
  // dış çağrı yapılmasını engellemeye değer.
  writeGetirbakimCache(key, products)
  return products
}

function matchesResolvedId(product: GetirbakimProduct, id: string): boolean {
  return product.id === id || product.sourceProductId === id
}

/**
 * Kalem yazımında GetirBakım ürününü yeniden çözer — fiyat istemciden gelmez.
 *
 * Önce `sku` (parça no) ile OEM araması, sonra serbest metin. İkisinde de
 * `id` / `sourceProductId` eşleşmesi şart: aynı kodla başka bir GetirBakım
 * kartı yazılmasın.
 */
export async function resolveGetirbakimProduct(
  id: string,
  sku?: string | null,
): Promise<GetirbakimProduct | null> {
  const needle = id.trim()
  if (!needle) return null
  const skuTrim = sku?.trim() || null

  if (skuTrim) {
    const byOem = await searchGetirbakimProducts({ oem: skuTrim, limit: GETIRBAKIM_MAX_LIMIT })
    const hit = byOem.find((product) => matchesResolvedId(product, needle))
    if (hit) return hit
  }

  const byQuery = await searchGetirbakimProducts({
    q: skuTrim || needle,
    limit: GETIRBAKIM_MAX_LIMIT,
  })
  return byQuery.find((product) => matchesResolvedId(product, needle)) ?? null
}

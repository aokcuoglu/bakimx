import "server-only"
import {
  getirbakimCacheKey,
  readGetirbakimCache,
  writeGetirbakimCache,
} from "./cache"
import { getGetirbakimProvider } from "./provider"
import {
  clampGetirbakimLimit,
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

  // Eşik altı serbest metin dışarı ÇIKMAZ. OEM sorgusu eşiğe tabi değil: kısa
  // ama geçerli parça kodları var ("OC90"), onları kesmek aramayı bozardı.
  if (!oem && (!q || q.length < GETIRBAKIM_MIN_SEARCH_LEN)) return []

  const key = getirbakimCacheKey({ q, oem, limit })
  const cached = readGetirbakimCache(key)
  if (cached) return cached

  const products = await getGetirbakimProvider().search({ q, oem, limit })

  // Boş sonuç da yazılır: "bu terim GetirBakım'da yok" bilgisi de tekrar tekrar
  // dış çağrı yapılmasını engellemeye değer.
  writeGetirbakimCache(key, products)
  return products
}

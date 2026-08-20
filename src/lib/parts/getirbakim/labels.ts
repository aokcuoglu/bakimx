import type { GetirbakimProduct } from "./types"

/**
 * GetirBakım satırının yüzey metinleri (BAK-183).
 *
 * Saf modül — istemci bileşeni de import ediyor, Prisma/`server-only` girmemeli
 * (bkz. bakimx-item.ts'teki aynı not).
 */

/** Kaynak rozetinin metni — satırın hangi katalogtan geldiğini söyler. */
export const GETIRBAKIM_SOURCE_LABEL = "GetirBakım"

/**
 * İskonto notu. `bakimx-price.ts`'teki `formatDiscountLabel` BURADA
 * KULLANILAMAZ: metni "BakımX iskontosu uygulandı" diye sabit ve bu satırdaki
 * iskonto GetirBakım'ın partner oranı — yanlış kaynağı işaret ederdi.
 */
export function getirbakimDiscountLabel(discountBps: number): string {
  if (discountBps <= 0) return ""
  const percent = discountBps / 100
  return `%${percent} ${GETIRBAKIM_SOURCE_LABEL} iskontosu uygulandı`
}

export function getirbakimStockLabel(product: GetirbakimProduct): string {
  if (product.stockQty > 0) return `Stok: ${product.stockQty}`
  // Fiyatı olan ama stoğu olmayan ürün GetirBakım tarafından TEDARİK EDİLEBİLİR;
  // "Stokta yok" demek satılabilir bir parçayı gizlerdi.
  if (product.availability === "SUPPLYABLE") return "Tedarik edilebilir"
  return "Stokta yok"
}

/**
 * Verinin ne kadar taze olduğunu söyleyen not.
 *
 * GÖSTERİLMESİ ZORUNLU (BAK-183 kabul kriteri): bu uç ANLIK stok vaat etmez.
 * `lastSyncedAt` yoksa da sessiz kalınmaz — "tazelik bilinmiyor" demek, hiçbir
 * şey dememekten dürüst.
 */
export function getirbakimFreshnessLabel(
  lastSyncedAt: string | null,
  now: Date = new Date(),
): string {
  if (!lastSyncedAt) return "Güncellik bilinmiyor"

  const synced = new Date(lastSyncedAt)
  if (Number.isNaN(synced.getTime())) return "Güncellik bilinmiyor"

  const diffMs = now.getTime() - synced.getTime()
  // İleri tarihli damga (saat kayması) "az önce" sayılır; negatif süre yazmayız.
  if (diffMs < 60_000) return "Az önce güncellendi"

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes} dk önce güncellendi`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} sa önce güncellendi`

  const days = Math.floor(hours / 24)
  return `${days} gün önce güncellendi`
}

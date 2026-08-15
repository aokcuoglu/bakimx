import { prisma } from "@/lib/db"

/**
 * BakımX ürününün araç uyumluluğunu kontrol et (BAK-46).
 * Ürün `vehicle_linked` ise, sağlanan araç tipi ürüne eşlenmiş olmalı.
 * `fitmentScope = universal` ürünler her zaman uyumlu.
 * Sunucu tarafı güvenlik kontrolü: istemcinin gönderdiği araç tipi değil,
 * sipariş/teklif kaydından okunur.
 *
 * SUNUCUYA ÖZEL — bilerek `bakimx-item.ts` dışında duruyor: o modülü istemci
 * bileşenleri (`part-search-input`, `parts-labor-grid`) `bakimxStockLabel` /
 * `bakimxLineItemFields` için import ediyor. Prisma erişimi orada kalırsa
 * `@/lib/db` → `next/headers` zinciri istemci paketine sızar ve derleme kırılır.
 */
export async function validateBakimxProductFitment(
  productId: string,
  vehicleTypeId: number | null,
): Promise<boolean> {
  if (!vehicleTypeId) return true
  const product = await prisma.bakimxProduct.findUnique({
    where: { id: productId },
    select: { fitmentScope: true, fitments: { select: { vehicleTypeId: true } } },
  })
  if (!product) return false
  if (product.fitmentScope === "universal") return true
  return product.fitments.some((f) => f.vehicleTypeId === vehicleTypeId)
}

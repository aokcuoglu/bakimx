import { NextResponse } from "next/server"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { hasWorkshopFeature } from "@/lib/plan"
import { rateLimit } from "@/lib/rate-limit"

/**
 * `/api/catalog/getirbakim/*` kapısı — auth + özellik kapısı + hız sınırı
 * (BAK-183).
 *
 * `bakimxCatalogRouteGuard`'ın kardeşi ama AYRI: o kapı bizim DB'mizi korur.
 * Buradaki her istek DIŞARI, GetirBakım'a bir çağrıya dönüşebilir.
 *
 * Pencere 120/dk/atölye (#755; önce 30/dk). Satır içi arama yazarken çalışır
 * (300 ms debounce): bir usta tek parça ararken 3–6 sorgu üretir, birden çok
 * usta aynı atölye kovasını paylaşır — 30/dk normal kullanımda 429'a düşüp
 * GetirBakım bölümünü sessizce boşaltıyordu. 120, GetirBakım'ın ürün araması
 * için istemci adresi başına verdiği sınırla aynıdır (partner anahtarı başına
 * 600/dk): tek bir atölye partner bütçesinin ancak beşte birini harcayabilir.
 * Aynı (sorgu, araç, limit) 60 sn önbellekten döner (cache.ts) ve dışarı
 * çıkmaz; GetirBakım'ın 429'u boş liste olarak düşer ve önbelleğe YAZILMAZ.
 *
 * Kapalı kapıda 403 + `feature_locked`: istemci bunu HATA olarak değil, ürünün o
 * atölyede YOK olması olarak okur ve bölümü hiç render etmez
 * (src/lib/parts/getirbakim/client.ts).
 */
/** Atölye başına dakikalık GetirBakım sorgu sınırı (bkz. yukarıdaki gerekçe). */
export const GETIRBAKIM_WORKSHOP_RATE_LIMIT = 120

export async function getirbakimRouteGuard(): Promise<
  NextResponse | { workshopId: string }
> {
  const { user, workshop } = await getCurrentUserWithWorkshop()

  if (!hasWorkshopFeature(workshop, "getirbakimCatalog")) {
    return NextResponse.json(
      { error: "GetirBakım stok/fiyat sorgusu bu çalışma alanında kapalı.", code: "feature_locked" },
      { status: 403 },
    )
  }

  const limit = await rateLimit(`getirbakim-catalog:${user.workshopId}`, GETIRBAKIM_WORKSHOP_RATE_LIMIT, 60_000)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla GetirBakım sorgusu yapıldı. Lütfen biraz bekleyip tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    )
  }

  return { workshopId: user.workshopId }
}

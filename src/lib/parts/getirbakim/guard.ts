import { NextResponse } from "next/server"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { hasFeature, type PlanTier } from "@/lib/plan"
import { rateLimit } from "@/lib/rate-limit"

/**
 * `/api/catalog/getirbakim/*` kapısı — auth + özellik kapısı + hız sınırı
 * (BAK-183).
 *
 * `bakimxCatalogRouteGuard`'ın kardeşi ama AYRI: o kapı bizim DB'mizi korur ve
 * penceresi buna göre geniş (120/dk). Buradaki her istek DIŞARI, GetirBakım'a
 * bir çağrıya dönüşebilir — pencere bilinçli olarak DAR tutulur, çünkü aşırı
 * kullanımın faturası bize değil partner ilişkisine çıkar.
 *
 * Kapalı kapıda 403 + `feature_locked`: istemci bunu HATA olarak değil, ürünün o
 * atölyede YOK olması olarak okur ve bölümü hiç render etmez
 * (src/lib/parts/getirbakim/client.ts).
 */
export async function getirbakimRouteGuard(): Promise<
  NextResponse | { workshopId: string }
> {
  const { user, workshop } = await getCurrentUserWithWorkshop()

  if (!hasFeature(workshop.planTier as PlanTier, "getirbakimCatalog")) {
    return NextResponse.json(
      { error: "GetirBakım stok/fiyat sorgusu bu çalışma alanında kapalı.", code: "feature_locked" },
      { status: 403 },
    )
  }

  const limit = await rateLimit(`getirbakim-catalog:${user.workshopId}`, 30, 60_000)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla GetirBakım sorgusu yapıldı. Lütfen biraz bekleyip tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    )
  }

  return { workshopId: user.workshopId }
}

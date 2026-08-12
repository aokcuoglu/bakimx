import { NextResponse } from "next/server"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { resolveFeature } from "@/lib/features"
import { type PlanTier } from "@/lib/plan"
import { rateLimit } from "@/lib/rate-limit"

/**
 * `/api/catalog/bakimx/*` ortak kapısı — auth + feature gate + rate limit.
 *
 * `tecdocRouteGuard`'ın kardeşi ama AYRI olması bilinçli: TecDoc kapısı
 * (`partsCatalog`) ücretli RapidAPI kotasını korur; BakımX kataloğu kendi
 * DB'mizden okunur ve bize maliyet doğurmaz. İkisi tek kapıya bağlanırsa
 * TecDoc'u kapatan atölye kendi kataloğumuzu da kaybeder.
 *
 * Yetki: herhangi bir atölye kullanıcısı (rol kapısı yok — okuma yolu).
 */
export async function bakimxCatalogRouteGuard(): Promise<NextResponse | { workshopId: string }> {
  const { user, workshop } = await getCurrentUserWithWorkshop()

  if (!(await resolveFeature(workshop.id, workshop.planTier as PlanTier, "bakimxCatalog"))) {
    return NextResponse.json(
      { error: "BakımX ürün kataloğu bu çalışma alanında kapalı.", code: "feature_locked" },
      { status: 403 },
    )
  }

  // DB-only sorgu: TecDoc penceresinden (30/dk) gevşek. Kapı burada kotayı
  // değil, tek atölyenin katalog taramasıyla veritabanını yormasını sınırlar.
  const limit = rateLimit(`bakimx-catalog:${user.workshopId}`, 120, 60_000)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla katalog isteği yapıldı. Lütfen biraz bekleyip tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    )
  }

  return { workshopId: user.workshopId }
}

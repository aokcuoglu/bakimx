import { NextResponse } from "next/server"
import { getCurrentUserWithWorkshop, requireWritableWorkshop } from "@/lib/auth"
import { resolveFeature } from "@/lib/features"
import { type PlanTier } from "@/lib/plan"
import { rateLimit } from "@/lib/rate-limit"
import { type Permission } from "@/lib/roles"

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

/**
 * YAZAN BakımX ucunun kapısı (BAK-60 — sipariş talebi).
 *
 * Okuma kapısının (`bakimxCatalogRouteGuard`) üstüne, server action'ların
 * geçtiği kapının AYNISINI koyar: `requireWritableWorkshop(permission)` → plan
 * yazma kilidi + geçici şifre kapısı + rol kapısı (bkz. src/lib/auth.ts).
 * Yazma yolu bir route handler olduğu için `src/lib/rbac-coverage.test.ts` bu
 * dosyayı taramaz — kapıyı burada TEK yerde tutmak, o kapsam testinin
 * göremediği yolun da elle atlanmamasını sağlıyor.
 *
 * Kapı hataları `throw` eder (rol/plan/şifre); route bunları 403'e çevirebilsin
 * diye burada yakalanmaz — {@link bakimxWriteGuardResponse} kullanın.
 */
export async function bakimxCatalogWriteGuard(
  permission: Permission,
): Promise<NextResponse | { workshopId: string; userId: string }> {
  const { user, workshop } = await requireWritableWorkshop(permission)

  if (!(await resolveFeature(workshop.id, workshop.planTier as PlanTier, "bakimxCatalog"))) {
    return NextResponse.json(
      { error: "BakımX ürün kataloğu bu çalışma alanında kapalı.", code: "feature_locked" },
      { status: 403 },
    )
  }

  // Yazma penceresi okumadan DAR: sipariş talebi tuş vuruşuyla değil, düğmeyle
  // oluşur. Kova da ayrı — katalog taraması sipariş verme hakkını yemesin.
  const limit = rateLimit(`bakimx-order:${user.workshopId}`, 20, 60_000)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla sipariş isteği gönderildi. Lütfen biraz bekleyip tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    )
  }

  return { workshopId: user.workshopId, userId: user.id }
}

/**
 * Kapıdan fırlayan hatayı ({@link bakimxCatalogWriteGuard}) istemcinin
 * anlayacağı 403'e çevirir. Beklenmeyen hatalar da 403'e düşer: yazma ucunda
 * "emin değilsen reddet" doğru varsayılan.
 */
export function bakimxWriteGuardResponse(error: unknown): NextResponse {
  const message =
    error instanceof Error && error.message
      ? error.message
      : "Bu işlem için yetkiniz yok."
  return NextResponse.json({ error: message }, { status: 403 })
}

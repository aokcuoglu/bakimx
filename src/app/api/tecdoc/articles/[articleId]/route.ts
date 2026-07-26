import { NextResponse } from "next/server"
import { getArticleCompatibility, getArticleDetail } from "@/lib/tecdoc/catalog"
import { tecdocRouteGuard, tecdocErrorResponse, parsePositiveInt } from "@/lib/tecdoc/api-helpers"
import type { ArticleCompatibility, ArticleDetailPublic } from "@/lib/tecdoc/types"

export interface ArticleDetailResponse {
  detail: ArticleDetailPublic
  /** `vehicleId` verilmediyse null — uygunluk araç bağlamı olmadan yorumlanamaz. */
  compatibility: ArticleCompatibility | null
}

/**
 * Parça detayı: teknik özellikler, OEM numaraları, EAN, görsel + (araç verilirse)
 * uygunluk durumu ve eşleşen araç kaydı.
 *
 * Detay tek faturalı çağrıdan gelir ve kalıcı cache'lenir (bkz. getArticleDetail);
 * aynı parça ikinci kez açıldığında sağlayıcıya gidilmez. Ağır `compatibleCars`
 * listesi (300+ kayıt) istemciye GÖNDERİLMEZ — yalnız eşleşme için kullanılır.
 */
export async function GET(request: Request, { params }: { params: Promise<{ articleId: string }> }) {
  const guard = await tecdocRouteGuard()
  if (guard instanceof NextResponse) return guard

  const articleId = parsePositiveInt((await params).articleId)
  if (articleId == null) {
    return NextResponse.json({ error: "Geçersiz parça kimliği." }, { status: 400 })
  }
  // Araç kimliği isteğe bağlı: parça detayı araçsız da açılabilir (o zaman
  // uygunluk bölümü hiç gösterilmez).
  const vehicleId = parsePositiveInt(new URL(request.url).searchParams.get("vehicleId"))

  try {
    const detail = await getArticleDetail(articleId)
    const compatibility = vehicleId != null ? await getArticleCompatibility(vehicleId, detail) : null

    const { compatibleCars: _compatibleCars, ...publicDetail } = detail
    return NextResponse.json({ detail: publicDetail, compatibility } satisfies ArticleDetailResponse)
  } catch (err) {
    return tecdocErrorResponse(err)
  }
}

import { NextResponse } from "next/server"
import { getArticleCrossRefs } from "@/lib/tecdoc/catalog"
import { tecdocRouteGuard, tecdocErrorResponse, parsePositiveInt } from "@/lib/tecdoc/api-helpers"

/**
 * Muadil / çapraz referanslar — parça detay modalinde bölüm AÇILDIĞINDA çağrılır
 * (tembel). Ayrı bir faturalı çağrı olduğu için detay ucuyla birleştirilmedi:
 * kullanıcıların çoğu muadillere bakmadan modalı kapatıyor.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ articleId: string }> }) {
  const guard = await tecdocRouteGuard()
  if (guard instanceof NextResponse) return guard

  const articleId = parsePositiveInt((await params).articleId)
  if (articleId == null) {
    return NextResponse.json({ error: "Geçersiz parça kimliği." }, { status: 400 })
  }

  try {
    return NextResponse.json({ crossRefs: await getArticleCrossRefs(articleId) })
  } catch (err) {
    return tecdocErrorResponse(err)
  }
}

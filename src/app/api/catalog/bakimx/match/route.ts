import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-errors"
import { matchBakimxProductsByPartNumbers } from "@/lib/parts/bakimx-catalog"
import { bakimxCatalogRouteGuard } from "@/lib/parts/bakimx-catalog-guard"

/**
 * TecDoc parça numaralarını BakımX ürünleriyle toplu eşleştir —
 * `POST /api/catalog/bakimx/match`.
 *
 * İstek gövdesi: `{ articleNumbers: string[] }` (sunucu tarafında 200 ile sınırlı).
 * Yanıt: `{ matches: { [articleNo]: BakimxProductSummary } }` — eşleşmeyen numara haritaya girmez.
 */
export async function POST(request: Request) {
  const guard = await bakimxCatalogRouteGuard()
  if (guard instanceof NextResponse) return guard

  try {
    const body = await request.json()
    const articleNumbers = Array.isArray(body?.articleNumbers)
      ? body.articleNumbers.filter((n: unknown) => typeof n === "string")
      : []

    const limit = 200
    if (articleNumbers.length > limit) {
      return NextResponse.json(
        {
          error: `Çok fazla parça numarası (sınır: ${limit})`,
          code: "invalid_params",
        },
        { status: 400 },
      )
    }

    const matches = await matchBakimxProductsByPartNumbers(articleNumbers)
    return NextResponse.json({ matches })
  } catch (err) {
    console.error("[bakimx-catalog/match]", err instanceof Error ? err.message : err)
    return apiErrorResponse(err)
  }
}

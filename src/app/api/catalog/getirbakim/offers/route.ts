import { NextResponse } from "next/server"
import { getirbakimRouteGuard } from "@/lib/parts/getirbakim/guard"
import { getGetirbakimProvider } from "@/lib/parts/getirbakim/provider"
import { classifyExactProducts, normalizePartNo } from "@/lib/parts/getirbakim/types"

export async function GET(request: Request) {
  const guard = await getirbakimRouteGuard()
  if (guard instanceof NextResponse) return guard

  const rawPartNo = new URL(request.url).searchParams.get("partNo") ?? ""
  const normalizedPartNo = normalizePartNo(rawPartNo)
  if (!normalizedPartNo) {
    return NextResponse.json({ status: "no_match", normalizedPartNo })
  }

  try {
    const result = await getGetirbakimProvider().findOffersByPartNo(normalizedPartNo)
    if (result.status === "no_match") {
      return NextResponse.json({ status: "no_match", normalizedPartNo })
    }
    return NextResponse.json({
      status: classifyExactProducts(result.products),
      normalizedPartNo,
      products: result.products,
    })
  } catch (error) {
    console.error("[getirbakim/offers]", error instanceof Error ? error.message : error)
    return NextResponse.json({ status: "upstream_error", normalizedPartNo }, { status: 502 })
  }
}

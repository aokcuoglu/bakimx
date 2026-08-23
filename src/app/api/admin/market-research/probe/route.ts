import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { getMarketResearchProvider } from "@/lib/market-research/provider"
import type { MarketResearchProvider } from "@/lib/market-research/types"

const MAX_QUERY_LENGTH = 200

interface ProbeDependencies {
  authorize: () => Promise<unknown>
  provider: () => MarketResearchProvider
}

const dependencies: ProbeDependencies = {
  authorize: requireAdmin,
  provider: getMarketResearchProvider,
}

export async function handleProbe(request: Request, deps: ProbeDependencies = dependencies) {
  await deps.authorize()

  let body: { query?: unknown; vehicle?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Geçerli bir JSON gövdesi gereklidir." }, { status: 400 })
  }

  const query = typeof body.query === "string" ? body.query.trim() : ""
  if (query.length < 2 || query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: "Arama sorgusu 2-200 karakter olmalıdır." }, { status: 400 })
  }
  const vehicle = typeof body.vehicle === "string" && body.vehicle.trim()
    ? body.vehicle.trim().slice(0, MAX_QUERY_LENGTH)
    : null

  try {
    const provider = deps.provider()
    if (provider.name !== "anthropic") {
      return NextResponse.json({ error: "Keşif probe'u Anthropic sağlayıcısı etkin değilken çalışmaz." }, { status: 503 })
    }
    const result = await provider.research({ query, vehicle }, { maxMonthlyRequests: 1 })
    if (!result.usage) throw new Error("Anthropic usage bilgisi eksik.")

    const domains = [...new Set(result.suggestions.flatMap((suggestion) =>
      suggestion.sources.map((source) => new URL(source.url).hostname.toLowerCase()),
    ))].sort()

    return NextResponse.json({
      success: true,
      domains,
      webSearches: result.usage.webSearches,
      costMicroUsd: result.usage.costMicroUsd,
    })
  } catch (error) {
    console.error("[market-research-probe]", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Keşif probe'u başarısız." }, { status: 503 })
  }
}

export async function POST(request: Request) {
  return handleProbe(request)
}

import { NextResponse } from "next/server"
import { resolveAdminMembership } from "@/lib/admin-membership"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { resolveFeature } from "@/lib/features"
import { getMarketResearchProvider } from "@/lib/market-research/provider"
import { getWorkshopMarketResearchCredential } from "@/lib/market-research/credential"
import { MarketResearchBudgetExceededError, MarketResearchQuotaExceededError } from "@/lib/market-research/budget"
import type { MarketResearchProvider } from "@/lib/market-research/types"
import { type PlanTier } from "@/lib/plan"
import { assertWritableOr403 } from "@/lib/plan-guard"
import { rateLimit } from "@/lib/rate-limit"

const MAX_TEXT_LENGTH = 200

type ResearchContext = Awaited<ReturnType<typeof getCurrentUserWithWorkshop>>

interface MarketResearchDependencies {
  authorize: () => Promise<ResearchContext>
  featureEnabled: (workshopId: string, tier: PlanTier) => Promise<boolean>
  provider: (apiKey?: string) => MarketResearchProvider
  credential: (workshopId: string) => Promise<{ apiKey: string } | null>
  rateLimitExempt: (user: ResearchContext["user"]) => Promise<boolean>
  limit: (key: string) => Promise<{ allowed: boolean; retryAfterMs: number }>
}

const dependencies: MarketResearchDependencies = {
  authorize: getCurrentUserWithWorkshop,
  featureEnabled: (workshopId, tier) => resolveFeature(workshopId, tier, "marketResearch"),
  provider: (apiKey) => getMarketResearchProvider(undefined, apiKey),
  credential: getWorkshopMarketResearchCredential,
  rateLimitExempt: async (user) => process.env.NODE_ENV === "development"
    || Boolean(await resolveAdminMembership({ id: user.id, email: user.email })),
  limit: (key) => rateLimit(key, 5, 60 * 60_000),
}

export async function handleMarketResearch(request: Request, deps: MarketResearchDependencies = dependencies) {
  const { user, workshop } = await deps.authorize()
  const locked = assertWritableOr403(workshop)
  if (locked) return locked

  if (!(await deps.featureEnabled(workshop.id, workshop.planTier as PlanTier))) {
    return NextResponse.json(
      { error: "Piyasa araştırması yalnızca Premium pakette kullanılabilir.", code: "feature_locked" },
      { status: 403 },
    )
  }

  let body: { query?: unknown; vehicle?: unknown; partNumbers?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Geçerli bir istek gövdesi gereklidir." }, { status: 400 })
  }

  const query = typeof body.query === "string" ? body.query.trim() : ""
  const vehicle = typeof body.vehicle === "string" ? body.vehicle.trim() : ""
  const partNumbers = typeof body.partNumbers === "string"
    ? body.partNumbers.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 10)
    : []
  if (query.length < 2 || query.length > MAX_TEXT_LENGTH || vehicle.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "Parça adı 2-200, araç bilgisi en fazla 200 karakter olmalıdır." }, { status: 400 })
  }

  if (!(await deps.rateLimitExempt(user))) {
    const limited = await deps.limit(`market-research:${workshop.id}:${user.id}`)
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Saatlik araştırma limitine ulaştınız. Lütfen daha sonra tekrar deneyin." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limited.retryAfterMs / 1000)) } },
      )
    }
  }

  try {
    const credential = await deps.credential(workshop.id)
    const provider = deps.provider(credential?.apiKey)
    if (provider.name !== "anthropic") {
      return NextResponse.json(
        { error: "Piyasa araştırması şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.", code: "service_unavailable" },
        { status: 503 },
      )
    }
    const result = await provider.research(
      { query, vehicle: vehicle || null, partNumbers },
      {
        workshop: {
          workshopId: workshop.id,
          userId: user.id,
          fundingSource: credential ? "customer" : "platform",
        },
      },
    )
    return NextResponse.json({ success: true, suggestions: result.suggestions })
  } catch (error) {
    console.error("[market-research]", error)
    if (error instanceof MarketResearchQuotaExceededError) {
      return NextResponse.json({ error: error.message, code: "monthly_limit_reached" }, { status: 429 })
    }
    if (error instanceof MarketResearchBudgetExceededError) {
      return NextResponse.json(
        { error: "Piyasa araştırması şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.", code: "budget_exhausted" },
        { status: 503 },
      )
    }
    const timedOut = error instanceof Error && (error.name === "AbortError" || error.message === "Request was aborted.")
    return NextResponse.json(
      {
        error: timedOut
          ? "Piyasa araştırması zaman aşımına uğradı. Lütfen sorguyu kısaltıp tekrar deneyin."
          : "Piyasa araştırması tamamlanamadı. Lütfen daha sonra tekrar deneyin.",
        code: timedOut ? "upstream_timeout" : "research_failed",
      },
      { status: timedOut ? 504 : 503 },
    )
  }
}

export async function POST(request: Request) {
  return handleMarketResearch(request)
}

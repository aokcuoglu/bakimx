import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

export const MICRO_USD = 1_000_000
// Sonnet standard context üst sınırı + 1.800 output token + 10 arama için
// çağrı öncesi muhafazakâr rezerv. Gerçek usage cevap sonrasında hesaplanır.
export const REQUEST_RESERVATION_MICRO_USD = 750_000

export interface AnthropicUsageLike {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
  server_tool_use?: { web_search_requests?: number | null } | null
}

export function estimateSonnetCostMicroUsd(usage: AnthropicUsageLike): { costMicroUsd: number; webSearches: number } {
  const input = usage.input_tokens + (usage.cache_creation_input_tokens ?? 0)
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const webSearches = usage.server_tool_use?.web_search_requests ?? 0
  // Sonnet: $3/MTok input, $0.30/MTok cache read, $15/MTok output;
  // web search: $10/1.000. Yukarı yuvarlama bütçeyi eksik yazmayı önler.
  const costMicroUsd = Math.ceil(input * 3 + cacheRead * 0.3 + usage.output_tokens * 15 + webSearches * 10_000)
  return { costMicroUsd, webSearches }
}

function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export function monthlyRequestLimitReached(
  requestCount: number,
  reservedMicroUsd: bigint,
  maxMonthlyRequests?: number,
): boolean {
  return maxMonthlyRequests != null && (requestCount >= maxMonthlyRequests || reservedMicroUsd > 0)
}

export async function reserveMarketResearchBudget(
  limitMicroUsd: number,
  now = new Date(),
  maxMonthlyRequests?: number,
): Promise<Date> {
  const monthStart = monthStartUtc(now)
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('market-research-budget'))`
    const row = await tx.marketResearchBudget.upsert({
      where: { monthStart },
      create: { monthStart },
      update: {},
    })
    if (monthlyRequestLimitReached(row.requestCount, row.reservedMicroUsd, maxMonthlyRequests)) {
      throw new Error("Bu ayın sınırlı piyasa araştırması keşif çağrısı zaten kullanıldı.")
    }
    if (row.spentMicroUsd + row.reservedMicroUsd + BigInt(REQUEST_RESERVATION_MICRO_USD) > BigInt(limitMicroUsd)) {
      throw new Error("Aylık piyasa araştırması bütçe tavanına ulaşıldı.")
    }
    await tx.marketResearchBudget.update({
      where: { monthStart },
      data: { reservedMicroUsd: { increment: BigInt(REQUEST_RESERVATION_MICRO_USD) } },
    })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  return monthStart
}

export async function settleMarketResearchBudget(monthStart: Date, usage: AnthropicUsageLike): Promise<number> {
  const { costMicroUsd, webSearches } = estimateSonnetCostMicroUsd(usage)
  await prisma.marketResearchBudget.update({
    where: { monthStart },
    data: {
      reservedMicroUsd: { decrement: BigInt(REQUEST_RESERVATION_MICRO_USD) },
      spentMicroUsd: { increment: BigInt(costMicroUsd) },
      requestCount: { increment: 1 },
      webSearchCount: { increment: webSearches },
    },
  })
  return costMicroUsd
}

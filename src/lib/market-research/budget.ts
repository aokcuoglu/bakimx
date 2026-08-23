import { MarketResearchFundingSource, Prisma } from "@prisma/client"
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

export const WORKSHOP_MONTHLY_RESEARCH_LIMIT = 30

export function workshopMonthlyQuotaReached(succeededCount: number, runningCount: number): boolean {
  return succeededCount + runningCount >= WORKSHOP_MONTHLY_RESEARCH_LIMIT
}

export function monthStartUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export class MarketResearchQuotaExceededError extends Error {
  constructor() {
    super("Aylık 30 piyasa araştırması limitine ulaştınız.")
    this.name = "MarketResearchQuotaExceededError"
  }
}

export class MarketResearchBudgetExceededError extends Error {
  constructor() {
    super("Aylık piyasa araştırması bütçe tavanına ulaşıldı.")
    this.name = "MarketResearchBudgetExceededError"
  }
}

interface ReserveUsageInput {
  workshopId: string
  userId: string
  fundingSource: MarketResearchFundingSource
  platformLimitMicroUsd: number
  now?: Date
}

/**
 * Şirket kotası ile platform bütçesini aynı transaction içinde ayırır.
 * Workshop advisory lock aynı şirketten eşzamanlı 31. isteğin geçmesini önler.
 * Başarısız çağrılar ledger'da kalır ama yalnız running+succeeded slot tutar.
 */
export async function reserveMarketResearchUsage(input: ReserveUsageInput): Promise<{ usageId: string; monthStart: Date }> {
  const monthStart = monthStartUtc(input.now ?? new Date())
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`market-research-workshop:${input.workshopId}`}))`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('market-research-budget'))`
    const now = input.now ?? new Date()
    const staleBefore = new Date(now.getTime() - 5 * 60_000)
    const stalePlatform = await tx.marketResearchUsage.count({
      where: { workshopId: input.workshopId, monthStart, status: "running", fundingSource: "platform", createdAt: { lt: staleBefore } },
    })
    await tx.marketResearchUsage.updateMany({
      where: { workshopId: input.workshopId, monthStart, status: "running", createdAt: { lt: staleBefore } },
      data: { status: "failed", errorCode: "stale_reservation", completedAt: now },
    })
    if (stalePlatform > 0) {
      const staleBudget = await tx.marketResearchBudget.findUnique({ where: { monthStart } })
      if (staleBudget) {
        const release = BigInt(stalePlatform * REQUEST_RESERVATION_MICRO_USD)
        await tx.marketResearchBudget.update({
          where: { monthStart },
          data: { reservedMicroUsd: staleBudget.reservedMicroUsd > release ? staleBudget.reservedMicroUsd - release : BigInt(0) },
        })
      }
    }
    const activeGroups = await tx.marketResearchUsage.groupBy({
      by: ["status"],
      where: { workshopId: input.workshopId, monthStart, status: { in: ["running", "succeeded"] } },
      _count: { _all: true },
    })
    const succeededCount = activeGroups.find((row) => row.status === "succeeded")?._count._all ?? 0
    const runningCount = activeGroups.find((row) => row.status === "running")?._count._all ?? 0
    if (workshopMonthlyQuotaReached(succeededCount, runningCount)) throw new MarketResearchQuotaExceededError()

    if (input.fundingSource === "platform") {
      const budget = await tx.marketResearchBudget.upsert({ where: { monthStart }, create: { monthStart }, update: {} })
      if (budget.spentMicroUsd + budget.reservedMicroUsd + BigInt(REQUEST_RESERVATION_MICRO_USD) > BigInt(input.platformLimitMicroUsd)) {
        throw new MarketResearchBudgetExceededError()
      }
      await tx.marketResearchBudget.update({
        where: { monthStart },
        data: { reservedMicroUsd: { increment: BigInt(REQUEST_RESERVATION_MICRO_USD) } },
      })
    }

    const usage = await tx.marketResearchUsage.create({
      data: {
        workshopId: input.workshopId,
        userId: input.userId,
        monthStart,
        fundingSource: input.fundingSource,
      },
      select: { id: true },
    })
    return { usageId: usage.id, monthStart }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

export async function settleMarketResearchUsage(
  reservation: { usageId: string; monthStart: Date },
  fundingSource: MarketResearchFundingSource,
  usage: AnthropicUsageLike,
  durationMs: number,
): Promise<number> {
  const estimate = estimateSonnetCostMicroUsd(usage)
  await prisma.$transaction(async (tx) => {
    if (fundingSource === "platform") {
      await tx.marketResearchBudget.update({
        where: { monthStart: reservation.monthStart },
        data: {
          reservedMicroUsd: { decrement: BigInt(REQUEST_RESERVATION_MICRO_USD) },
          spentMicroUsd: { increment: BigInt(estimate.costMicroUsd) },
          requestCount: { increment: 1 },
          webSearchCount: { increment: estimate.webSearches },
        },
      })
    }
    await tx.marketResearchUsage.update({
      where: { id: reservation.usageId },
      data: {
        status: "succeeded",
        estimatedCostMicroUsd: BigInt(estimate.costMicroUsd),
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: usage.cache_read_input_tokens ?? 0,
        webSearchCount: estimate.webSearches,
        durationMs,
        completedAt: new Date(),
      },
    })
  })
  return estimate.costMicroUsd
}

export async function failMarketResearchUsage(
  reservation: { usageId: string; monthStart: Date },
  fundingSource: MarketResearchFundingSource,
  errorCode: string,
  durationMs: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (fundingSource === "platform") {
      await tx.marketResearchBudget.update({
        where: { monthStart: reservation.monthStart },
        data: { reservedMicroUsd: { decrement: BigInt(REQUEST_RESERVATION_MICRO_USD) } },
      })
    }
    await tx.marketResearchUsage.update({
      where: { id: reservation.usageId },
      data: { status: "failed", errorCode: errorCode.slice(0, 80), durationMs, completedAt: new Date() },
    })
  })
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

/** Sağlayıcı isteği cevap üretmeden düşerse ayrılmış bütçeyi serbest bırakır. */
export async function releaseMarketResearchBudget(monthStart: Date): Promise<void> {
  await prisma.marketResearchBudget.update({
    where: { monthStart },
    data: { reservedMicroUsd: { decrement: BigInt(REQUEST_RESERVATION_MICRO_USD) } },
  })
}

import { prisma } from "@/lib/db"
import { monthStartUtc, WORKSHOP_MONTHLY_RESEARCH_LIMIT } from "./budget"

function asNumber(value: bigint | number | null | undefined): number {
  return Number(value ?? 0)
}

export async function getWorkshopMarketResearchUsage(workshopId: string, now = new Date()) {
  const monthStart = monthStartUtc(now)
  const [groups, recent, credential] = await Promise.all([
    prisma.marketResearchUsage.groupBy({
      by: ["status", "fundingSource"],
      where: { workshopId, monthStart },
      _count: { _all: true },
      _sum: { estimatedCostMicroUsd: true, webSearchCount: true },
    }),
    prisma.marketResearchUsage.findMany({
      where: { workshopId, monthStart },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, status: true, fundingSource: true, estimatedCostMicroUsd: true,
        webSearchCount: true, createdAt: true, durationMs: true,
      },
    }),
    prisma.marketResearchCredential.findUnique({
      where: { workshopId },
      select: { maskedLast4: true, updatedAt: true },
    }),
  ])
  const succeeded = groups.filter((row) => row.status === "succeeded")
  const runningCount = groups.filter((row) => row.status === "running").reduce((sum, row) => sum + row._count._all, 0)
  const requestCount = succeeded.reduce((sum, row) => sum + row._count._all, 0)
  const cost = (source?: "platform" | "customer") => succeeded
    .filter((row) => !source || row.fundingSource === source)
    .reduce((sum, row) => sum + asNumber(row._sum.estimatedCostMicroUsd), 0)
  return {
    summary: {
      monthStart: monthStart.toISOString(),
      monthlyLimit: WORKSHOP_MONTHLY_RESEARCH_LIMIT,
      requestCount,
      reservedRequests: runningCount,
      remainingRequests: Math.max(0, WORKSHOP_MONTHLY_RESEARCH_LIMIT - requestCount - runningCount),
      estimatedCostMicroUsd: cost(),
      webSearchCount: succeeded.reduce((sum, row) => sum + asNumber(row._sum.webSearchCount), 0),
      platformCostMicroUsd: cost("platform"),
      byokCostMicroUsd: cost("customer"),
    },
    credential: credential
      ? { configured: true as const, maskedLast4: credential.maskedLast4, updatedAt: credential.updatedAt.toISOString() }
      : { configured: false as const },
    recent: recent.map((row) => ({
      ...row,
      estimatedCostMicroUsd: Number(row.estimatedCostMicroUsd),
      createdAt: row.createdAt.toISOString(),
    })),
  }
}

export async function getAdminMarketResearchUsage(now = new Date()) {
  const monthStart = monthStartUtc(now)
  const [budget, byok, recent] = await Promise.all([
    prisma.marketResearchBudget.findUnique({ where: { monthStart } }),
    prisma.marketResearchUsage.aggregate({
      where: { monthStart, fundingSource: "customer", status: "succeeded" },
      _count: { _all: true },
    }),
    prisma.marketResearchUsage.findMany({
      where: { monthStart }, orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, workshopId: true, status: true, fundingSource: true, estimatedCostMicroUsd: true, webSearchCount: true, createdAt: true, durationMs: true },
    }),
  ])
  const configuredUsd = process.env.MARKET_RESEARCH_MONTHLY_BUDGET_USD?.trim()
  const budgetMicroUsd = Math.floor((configuredUsd ? Number(configuredUsd) : process.env.NODE_ENV === "production" ? 25 : 5) * 1_000_000)
  return {
    summary: {
      monthStart: monthStart.toISOString(),
      budgetMicroUsd,
      spentMicroUsd: asNumber(budget?.spentMicroUsd),
      reservedMicroUsd: asNumber(budget?.reservedMicroUsd),
      requestCount: budget?.requestCount ?? 0,
      webSearchCount: budget?.webSearchCount ?? 0,
      byokRequestCount: byok._count._all,
    },
    recent: recent.map((row) => ({ ...row, estimatedCostMicroUsd: Number(row.estimatedCostMicroUsd), createdAt: row.createdAt.toISOString() })),
  }
}

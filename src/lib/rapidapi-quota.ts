import { Prisma, type Workshop } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getPlanState, VIN_LOOKUP_QUOTA, type PlanTier } from "@/lib/plan"

const DEFAULT_MONTHLY_CAP = 18_000 // headroom under the 20k RapidAPI plan

export type WorkshopQuotaSource = "vin" | "tecdoc"

/** Tenant entitlement snapshot carried all the way to a billable provider miss. */
export interface WorkshopQuotaContext {
  workshopId: string
  tier: PlanTier
  extraVinQuota: number
}

type WorkshopQuotaFields = Pick<
  Workshop,
  | "id"
  | "planTier"
  | "subscriptionStatus"
  | "approvalStatus"
  | "trialEndsAt"
  | "currentPeriodEnd"
  | "extraVinQuota"
>

export function getWorkshopQuotaContext(workshop: WorkshopQuotaFields): WorkshopQuotaContext {
  return {
    workshopId: workshop.id,
    tier: getPlanState(workshop).accessTier,
    extraVinQuota: Math.max(0, workshop.extraVinQuota ?? 0),
  }
}

export class WorkshopQuotaExceededError extends Error {
  readonly code = "quota_exceeded"
  readonly cap: number

  constructor(cap: number) {
    super(
      cap <= 0
        ? "Bu pakette şase/parça sorgusu bulunmuyor. Paketinizi yükseltin."
        : "Aylık katalog sorgu limitiniz doldu. Ek kota satın almak için Paketler & Kullanım sayfasını kullanın.",
    )
    this.name = "WorkshopQuotaExceededError"
    this.cap = cap
  }
}

/** Single cap for the whole RapidAPI subscription — VIN lookups and TecDoc
 * catalog calls bill the same 20k/month plan, so their caps must not add up
 * independently. */
export function rapidApiMonthlyCap(): number {
  const raw = Number(process.env.RAPIDAPI_MONTHLY_CAP ?? process.env.VIN_LOOKUP_MONTHLY_CAP)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MONTHLY_CAP
}

/** Atölyenin teorik aylık kotası = tier kotası + ek kota (UI gösterimi için). */
export function workshopMonthlyCap(tier: PlanTier, extraVinQuota: number): number {
  return (VIN_LOOKUP_QUOTA[tier] ?? 0) + Math.max(0, extraVinQuota)
}

export function quotaMonthWindow(now: Date = new Date()): { monthStart: Date; renewsAt: Date } {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const renewsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return { monthStart, renewsAt }
}

// ---------------------------------------------------------------------------
// Global RapidAPI usage (admin dashboard)
// ---------------------------------------------------------------------------

/** Billed RapidAPI calls this month == cache rows created this month across
 * both cache tables (errors are never cached, hits never create rows). */
export async function countRapidApiCallsThisMonth(): Promise<number> {
  const { monthStart } = quotaMonthWindow()
  const [vin, tecdoc] = await Promise.all([
    prisma.vinLookup.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.tecdocCache.count({ where: { createdAt: { gte: monthStart } } }),
  ])
  return vin + tecdoc
}

// ---------------------------------------------------------------------------
// Per-workshop quota tracking
// ---------------------------------------------------------------------------

export interface QuotaReservationClient {
  $executeRaw(query: Prisma.Sql): Promise<number>
  quotaUsage: {
    count(args: Prisma.QuotaUsageCountArgs): Promise<number>
    create(args: Prisma.QuotaUsageCreateArgs): Promise<unknown>
  }
}

export interface QuotaReservationDatabase {
  $transaction<T>(operation: (tx: QuotaReservationClient) => Promise<T>): Promise<T>
}

/**
 * Atomically reserves one tenant call before the upstream request begins.
 *
 * The PostgreSQL transaction advisory lock is scoped to workshop + UTC month.
 * Concurrent VIN/TecDoc misses for the same tenant therefore serialize around
 * count + insert and can never pass the cap together. The row commits before
 * the provider call, so upstream failures remain charged exactly as billed.
 */
export async function reserveWorkshopQuota(
  context: WorkshopQuotaContext,
  source: WorkshopQuotaSource,
  database: QuotaReservationDatabase = prisma as unknown as QuotaReservationDatabase,
  now: Date = new Date(),
): Promise<void> {
  const cap = workshopMonthlyCap(context.tier, context.extraVinQuota)
  const { monthStart, renewsAt } = quotaMonthWindow(now)
  const lockKey = `workshop-quota:${context.workshopId}:${monthStart.toISOString().slice(0, 7)}`

  await database.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`)
    const used = await tx.quotaUsage.count({
      where: {
        workshopId: context.workshopId,
        createdAt: { gte: monthStart, lt: renewsAt },
      },
    })
    if (cap <= 0 || used >= cap) throw new WorkshopQuotaExceededError(cap)
    await tx.quotaUsage.create({
      // Keep the row in the same UTC window used for the lock and cap check,
      // even if a transaction happens to cross midnight at month end.
      data: { workshopId: context.workshopId, source, createdAt: now },
    })
  })
}

/** Count billable calls this month for a specific workshop. */
export async function countWorkshopCallsThisMonth(workshopId: string): Promise<number> {
  const { monthStart, renewsAt } = quotaMonthWindow()
  return prisma.quotaUsage.count({
    where: { workshopId, createdAt: { gte: monthStart, lt: renewsAt } },
  })
}

export interface WorkshopQuotaUsage {
  monthStart: Date
  renewsAt: Date
  baseQuota: number
  extraQuota: number
  totalCap: number
  used: number
  remaining: number
  pct: number
  vinUsed: number
  tecdocUsed: number
}

export function summarizeWorkshopQuotaUsage(
  context: WorkshopQuotaContext,
  rows: readonly { source: string; count: number }[],
  now: Date = new Date(),
): WorkshopQuotaUsage {
  const { monthStart, renewsAt } = quotaMonthWindow(now)
  const baseQuota = VIN_LOOKUP_QUOTA[context.tier] ?? 0
  const extraQuota = Math.max(0, context.extraVinQuota)
  const totalCap = baseQuota + extraQuota
  const vinUsed = rows.filter((row) => row.source === "vin").reduce((sum, row) => sum + row.count, 0)
  const tecdocUsed = rows.filter((row) => row.source === "tecdoc").reduce((sum, row) => sum + row.count, 0)
  const used = vinUsed + tecdocUsed
  return {
    monthStart,
    renewsAt,
    baseQuota,
    extraQuota,
    totalCap,
    used,
    remaining: Math.max(0, totalCap - used),
    pct: totalCap > 0 ? Math.min(100, Math.round((used / totalCap) * 100)) : 0,
    vinUsed,
    tecdocUsed,
  }
}

export async function getWorkshopQuotaUsage(
  context: WorkshopQuotaContext,
  now: Date = new Date(),
): Promise<WorkshopQuotaUsage> {
  const { monthStart, renewsAt } = quotaMonthWindow(now)
  const groups = await prisma.quotaUsage.groupBy({
    by: ["source"],
    where: {
      workshopId: context.workshopId,
      createdAt: { gte: monthStart, lt: renewsAt },
    },
    _count: { _all: true },
  })
  return summarizeWorkshopQuotaUsage(
    context,
    groups.map((group) => ({ source: group.source, count: group._count._all })),
    now,
  )
}

// ---------------------------------------------------------------------------
// Admin observability
// ---------------------------------------------------------------------------

export interface RapidApiUsage {
  monthStart: Date
  cap: number
  total: number
  pct: number
  /** Per-source billed calls this month (rows created) + cache serves saved. */
  breakdown: { label: string; billed: number; served: number }[]
}

/**
 * Admin observability for the shared RapidAPI quota. IMPORTANT: this counts only
 * calls this app recorded (cache/lookup rows created this month). It can UNDER-
 * count the provider's own dashboard because errored calls are billed but never
 * cached and DB recreation wipes rows. Treat the provider dashboard as truth.
 */
export async function getRapidApiUsage(): Promise<RapidApiUsage> {
  const { monthStart } = quotaMonthWindow()
  const where = { createdAt: { gte: monthStart } }
  const [vinRows, vinServed, tecdocByEndpoint] = await Promise.all([
    prisma.vinLookup.count({ where }),
    prisma.vinLookup.aggregate({ where, _sum: { hitCount: true } }),
    prisma.tecdocCache.groupBy({ by: ["endpoint"], where, _count: true, _sum: { hitCount: true } }),
  ])

  const breakdown = [
    { label: "Şase sorgu", billed: vinRows, served: vinServed._sum.hitCount ?? 0 },
    ...tecdocByEndpoint
      .map((entry) => ({
        label: `Katalog · ${entry.endpoint}`,
        billed: entry._count,
        served: entry._sum.hitCount ?? 0,
      }))
      .sort((a, b) => b.billed - a.billed),
  ]

  const total = breakdown.reduce((sum, entry) => sum + entry.billed, 0)
  const cap = rapidApiMonthlyCap()
  return { monthStart, cap, total, pct: cap > 0 ? (total / cap) * 100 : 0, breakdown }
}

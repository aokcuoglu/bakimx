import { prisma } from "@/lib/db"
import { VIN_LOOKUP_QUOTA, type PlanTier } from "@/lib/plan"

const DEFAULT_MONTHLY_CAP = 18_000 // headroom under the 20k RapidAPI plan

/** Single cap for the whole RapidAPI subscription — VIN lookups and TecDoc
 *  catalog calls bill the same 20k/month plan, so their caps must not add up
 *  independently. */
export function rapidApiMonthlyCap(): number {
  const raw = Number(process.env.RAPIDAPI_MONTHLY_CAP ?? process.env.VIN_LOOKUP_MONTHLY_CAP)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MONTHLY_CAP
}

/** Atölyenin teorik aylık kotası = tier kotası + ek kota (UI gösterimi için). */
export function workshopMonthlyCap(tier: PlanTier, extraVinQuota: number): number {
  return (VIN_LOOKUP_QUOTA[tier] ?? 0) + Math.max(0, extraVinQuota)
}

/** Start of the current UTC month (billing window boundary). */
function monthStartUtc(): Date {
  const d = new Date()
  d.setUTCDate(1)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

// ---------------------------------------------------------------------------
// Global RapidAPI usage (admin dashboard)
// ---------------------------------------------------------------------------

/** Billed RapidAPI calls this month == cache rows created this month across
 *  both cache tables (errors are never cached, hits never create rows). */
export async function countRapidApiCallsThisMonth(): Promise<number> {
  const monthStart = monthStartUtc()
  const [vin, tecdoc] = await Promise.all([
    prisma.vinLookup.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.tecdocCache.count({ where: { createdAt: { gte: monthStart } } }),
  ])
  return vin + tecdoc
}

// ---------------------------------------------------------------------------
// Per-workshop quota tracking
// ---------------------------------------------------------------------------

/** Record a billable call for a specific workshop. */
export async function recordQuotaUsage(
  workshopId: string,
  source: "vin" | "tecdoc",
): Promise<void> {
  await prisma.quotaUsage.create({
    data: { workshopId, source },
  })
}

/** Count billable calls this month for a specific workshop. */
export async function countWorkshopCallsThisMonth(workshopId: string): Promise<number> {
  const monthStart = monthStartUtc()
  return prisma.quotaUsage.count({
    where: { workshopId, createdAt: { gte: monthStart } },
  })
}

/** Check if a workshop has quota available. Throws if exceeded. */
export async function assertQuotaAvailable(
  workshopId: string,
  tier: PlanTier,
  extraVinQuota: number,
): Promise<void> {
  const cap = workshopMonthlyCap(tier, extraVinQuota)
  if (cap <= 0) {
    throw new Error("Bu pakette şase/parça sorgusu bulunmuyor. Paketinizi yükseltin.")
  }
  const used = await countWorkshopCallsThisMonth(workshopId)
  if (used >= cap) {
    throw new Error(
      "Aylık katalog sorgu limitiniz doldu. Ek kota satın almak için Kota Yönetimi sayfasını kullanın."
    )
  }
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
 * count the provider's own dashboard because (a) errored calls are billed but
 * never cached, and (b) a `prisma migrate reset` / DB recreation wipes these
 * rows while the provider keeps counting. Treat the provider dashboard as truth.
 */
export async function getRapidApiUsage(): Promise<RapidApiUsage> {
  const monthStart = monthStartUtc()
  const where = { createdAt: { gte: monthStart } }
  const [vinRows, vinServed, tecdocByEndpoint] = await Promise.all([
    prisma.vinLookup.count({ where }),
    prisma.vinLookup.aggregate({ where, _sum: { hitCount: true } }),
    prisma.tecdocCache.groupBy({ by: ["endpoint"], where, _count: true, _sum: { hitCount: true } }),
  ])

  const breakdown = [
    { label: "Şase sorgu", billed: vinRows, served: vinServed._sum.hitCount ?? 0 },
    ...tecdocByEndpoint
      .map((e) => ({
        label: `Katalog · ${e.endpoint}`,
        billed: e._count,
        served: e._sum.hitCount ?? 0,
      }))
      .sort((a, b) => b.billed - a.billed),
  ]

  const total = breakdown.reduce((sum, b) => sum + b.billed, 0)
  const cap = rapidApiMonthlyCap()
  return { monthStart, cap, total, pct: cap > 0 ? (total / cap) * 100 : 0, breakdown }
}

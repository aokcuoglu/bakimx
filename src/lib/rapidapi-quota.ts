import { Prisma, type Workshop } from "@prisma/client"
import { prisma } from "@/lib/db"
import { ADDON_LOCKED_MESSAGE, getVinLookupBaseQuota } from "@/lib/plan"

const DEFAULT_MONTHLY_CAP = 18_000 // headroom under the 20k RapidAPI plan

export type WorkshopQuotaSource = "vin" | "tecdoc"

/** Tenant entitlement snapshot carried all the way to a billable provider miss. */
export interface WorkshopQuotaContext {
  workshopId: string
  /**
   * Aylık taban kota — hesabın tüm şubeleri üzerinden `getVinLookupBaseQuota`
   * (paket ya da şaseden parça ek özelliği, #827) değerlerinin EN YÜKSEĞİ
   * (#829): kullanım hesap genelinde sayıldığı için tavan da şubeden bağımsızdır.
   * Ek kota (`extraVinQuota`) HARİÇ.
   */
  baseQuota: number
  /** Hesap genelindeki `extraVinQuota` toplamı. */
  extraVinQuota: number
  /**
   * Kotayı paylaşan atölyeler (#829): organizasyonsuz atölye tek başınadır;
   * aksi halde organizasyonun tüm `customer` şubeleri. Sunucuda, oturum
   * atölyesinin `organizationId`'sinden çözülür.
   */
  scopeWorkshopIds: string[]
  /** Kotayı paylaşan atölye sayısı (arayüz metni: tek şubede "hesap genelinde" denmez). */
  workshopCount: number
  /** Advisory lock anahtarı: organizasyon id'si, yoksa atölye id'si. */
  lockScope: string
}

export type WorkshopQuotaFields = Pick<
  Workshop,
  | "id"
  | "organizationId"
  | "planTier"
  | "subscriptionStatus"
  | "approvalStatus"
  | "trialEndsAt"
  | "currentPeriodEnd"
  | "extraVinQuota"
  | "addons"
>

export type QuotaScopeMember = Pick<
  Workshop,
  | "id"
  | "planTier"
  | "subscriptionStatus"
  | "approvalStatus"
  | "trialEndsAt"
  | "currentPeriodEnd"
  | "extraVinQuota"
  | "addons"
>

export interface QuotaScopeClient {
  workshop: {
    findMany(args: Prisma.WorkshopFindManyArgs): Promise<QuotaScopeMember[]>
  }
}

/**
 * Kota bağlamını çözer. Ek özellikler tüm şubelere yayıldığı için atölyenin
 * kendi hakkı hesabın hakkıdır; taban kota şubelerin en yükseği, ek kota hesap
 * genelinde toplanır. Organizasyonu
 * olmayan atölye için ek sorgu yoktur.
 */
export async function resolveWorkshopQuotaContext(
  workshop: WorkshopQuotaFields,
  db: QuotaScopeClient = prisma as unknown as QuotaScopeClient,
): Promise<WorkshopQuotaContext> {
  const ownBase = getVinLookupBaseQuota(workshop)
  const ownExtra = Math.max(0, workshop.extraVinQuota ?? 0)
  if (workshop.organizationId == null) {
    return {
      workshopId: workshop.id,
      baseQuota: ownBase,
      extraVinQuota: ownExtra,
      scopeWorkshopIds: [workshop.id],
      workshopCount: 1,
      lockScope: workshop.id,
    }
  }
  const members = await db.workshop.findMany({
    where: { organizationId: workshop.organizationId, kind: "customer" },
    select: {
      id: true,
      planTier: true,
      subscriptionStatus: true,
      approvalStatus: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
      extraVinQuota: true,
      addons: true,
    },
  })
  const baseQuota = Math.max(ownBase, ...members.map((m) => getVinLookupBaseQuota(m)))
  const scope = new Set<string>([workshop.id, ...members.map((m) => m.id)])
  const extraVinQuota = members.some((m) => m.id === workshop.id)
    ? members.reduce((sum, m) => sum + Math.max(0, m.extraVinQuota ?? 0), 0)
    : ownExtra + members.reduce((sum, m) => sum + Math.max(0, m.extraVinQuota ?? 0), 0)
  return {
    workshopId: workshop.id,
    baseQuota,
    extraVinQuota,
    scopeWorkshopIds: [...scope],
    workshopCount: scope.size,
    lockScope: workshop.organizationId,
  }
}

export class WorkshopQuotaExceededError extends Error {
  readonly code = "quota_exceeded"
  readonly cap: number

  constructor(cap: number) {
    super(
      cap <= 0
        ? ADDON_LOCKED_MESSAGE
        : "Aylık katalog sorgu limitiniz doldu. Ek kota için bizimle iletişime geçin.",
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

/** Atölyenin aylık kotası = taban kota + ek kota. */
export function workshopMonthlyCap(baseQuota: number, extraVinQuota: number): number {
  return Math.max(0, baseQuota) + Math.max(0, extraVinQuota)
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
 * The PostgreSQL transaction advisory lock is scoped to account (organization,
 * or the lone workshop) + UTC month, and usage is counted across every branch of
 * the account (#829). Concurrent VIN/TecDoc misses for the same account
 * therefore serialize around count + insert and can never pass the cap together. The row commits before
 * the provider call, so upstream failures remain charged exactly as billed.
 */
export async function reserveWorkshopQuota(
  context: WorkshopQuotaContext,
  source: WorkshopQuotaSource,
  database: QuotaReservationDatabase = prisma as unknown as QuotaReservationDatabase,
  now: Date = new Date(),
): Promise<void> {
  const cap = workshopMonthlyCap(context.baseQuota, context.extraVinQuota)
  const { monthStart, renewsAt } = quotaMonthWindow(now)
  const lockKey = `workshop-quota:${context.lockScope}:${monthStart.toISOString().slice(0, 7)}`

  await database.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`)
    const used = await tx.quotaUsage.count({
      where: {
        workshopId: { in: context.scopeWorkshopIds },
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
  /** Kotayı paylaşan atölye sayısı. */
  workshopCount: number
}

export function summarizeWorkshopQuotaUsage(
  context: WorkshopQuotaContext,
  rows: readonly { source: string; count: number }[],
  now: Date = new Date(),
): WorkshopQuotaUsage {
  const { monthStart, renewsAt } = quotaMonthWindow(now)
  const baseQuota = Math.max(0, context.baseQuota)
  const extraQuota = Math.max(0, context.extraVinQuota)
  const totalCap = workshopMonthlyCap(baseQuota, extraQuota)
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
    workshopCount: Math.max(1, context.workshopCount),
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
      workshopId: { in: context.scopeWorkshopIds },
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

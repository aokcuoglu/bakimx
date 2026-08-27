import { prisma } from "@/lib/db"
import { formatMinor, getPlanPriceMinor } from "@/lib/billing/pricing"
import type { PlanTier } from "@/lib/plan"
import type { BillingCycle } from "@prisma/client"
import type { AdminWorkshopRow } from "@/app/admin/admin-workshops"
import type { AdminDemoRequestRow, AdminSupportRequestRow } from "@/app/admin/admin-requests"
import type { AdminOrderRow, AdminSubRow, AdminTxnRow, AdminStuckTxnRow } from "@/app/admin/admin-billing"
import {
  WORKSHOP_PAGE_SIZE,
  buildWorkshopWhere,
  type WorkshopListQuery,
} from "@/lib/admin-workshop-filters"
import { INTERNAL_OPERATIONS_WORKSHOP_ID } from "@/lib/workshop-kind"

export interface WorkshopListResult {
  rows: AdminWorkshopRow[]
  /** Filtreye uyan TOPLAM kayıt — sayfadaki satır sayısı değil. */
  total: number
  totalPages: number
}

/**
 * İş yeri listesinin tek sayfası. Arama, filtre ve sıralama sunucu tarafında;
 * istemciye yalnız bir sayfalık satır gider (BAK-95).
 *
 * Sıralama "aksiyon gerektiren önce" kuralını korur ama artık SQL'de:
 * `approvalStatus` Postgres enum bildirim sırasına göre sıralanır
 * (`prisma/schema.prisma:113-117` — `pending` ilk), ardından paket talebi olan
 * satırlar (`nulls: "last"`), sonra yeni kayıtlar. Bu enum sırası bağımlılığı
 * `src/lib/admin-workshop-filters.test.ts` ile korunuyor.
 */
export async function getWorkshopRows(query: WorkshopListQuery): Promise<WorkshopListResult> {
  const where = buildWorkshopWhere(query)
  const [workshops, total] = await Promise.all([
    prisma.workshop.findMany({
      where,
      orderBy: [
        { approvalStatus: "asc" },
        { requestedPlanTier: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      take: WORKSHOP_PAGE_SIZE,
      skip: (query.page - 1) * WORKSHOP_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        approvalStatus: true,
        subscriptionStatus: true,
        planTier: true,
        requestedPlanTier: true,
        trialEndsAt: true,
        currentPeriodEnd: true,
        extraSeats: true,
        acquisitionSource: true,
        acquisitionAdvisorId: true,
        createdAt: true,
        // İlk kullanıcı artık e-postasız olabilir (BAK-40); sütun "iletişim
        // e-postası" gösterdiği için e-postası olan ilk üyeyi seçiyoruz.
        users: {
          where: { email: { not: null } },
          select: { email: true },
          take: 1,
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.workshop.count({ where }),
  ])

  const rows: AdminWorkshopRow[] = workshops.map((w) => ({
    id: w.id,
    name: w.name,
    ownerEmail: w.users[0]?.email ?? null,
    approvalStatus: w.approvalStatus,
    subscriptionStatus: w.subscriptionStatus,
    planTier: w.planTier,
    requestedPlanTier: w.requestedPlanTier,
    trialEndsAt: w.trialEndsAt ? w.trialEndsAt.toISOString() : null,
    currentPeriodEnd: w.currentPeriodEnd ? w.currentPeriodEnd.toISOString() : null,
    extraSeats: w.extraSeats,
    acquisitionSource: w.acquisitionSource,
    acquisitionAdvisorId: w.acquisitionAdvisorId,
    createdAt: w.createdAt.toISOString(),
  }))

  return { rows, total, totalPages: Math.max(1, Math.ceil(total / WORKSHOP_PAGE_SIZE)) }
}

/** Ops ana sayfasının "Dikkat gerektirenler" listesinde gösterilen en fazla
 *  kayıt — kalanı iş yerleri sayfasındaki filtreye devredilir. */
const PENDING_PREVIEW_TAKE = 10

export interface AdminWorkshopSummary {
  total: number
  pending: number
  planRequests: number
  /** En eski bekleyenden başlayan kısa liste; `pending` toplamı bundan büyük olabilir. */
  pendingPreview: { id: string; name: string }[]
}

export async function getAcquisitionSummary() {
  const groups = await prisma.workshop.groupBy({ by: ["acquisitionSource"], _count: { _all: true }, where: { kind: "customer" } })
  const rows = await Promise.all(groups.map(async (group) => {
    const [active, purchased, revenue] = await Promise.all([
      prisma.workshop.count({ where: { kind: "customer", acquisitionSource: group.acquisitionSource, subscriptionStatus: { in: ["active", "trialing"] } } }),
      prisma.workshop.count({ where: { kind: "customer", acquisitionSource: group.acquisitionSource, billingOrders: { some: { status: "confirmed" } } } }),
      prisma.billingOrder.aggregate({ where: { status: "confirmed", workshop: { kind: "customer", acquisitionSource: group.acquisitionSource } }, _sum: { amountMinor: true } }),
    ])
    return { source: group.acquisitionSource, workshops: group._count._all, active, purchased, revenueMinor: revenue._sum.amountMinor ?? 0 }
  }))
  return rows
}

/** Ops ana sayfası sayaçları — tüm tabloyu çekmeden `count` ile hesaplanır. */
export async function getWorkshopSummary(): Promise<AdminWorkshopSummary> {
  const [total, pending, planRequests, pendingPreview] = await Promise.all([
    prisma.workshop.count({ where: { kind: "customer" } }),
    prisma.workshop.count({ where: { kind: "customer", approvalStatus: "pending" } }),
    prisma.workshop.count({ where: { kind: "customer", requestedPlanTier: { not: null } } }),
    prisma.workshop.findMany({
      where: { kind: "customer", approvalStatus: "pending" },
      orderBy: { createdAt: "asc" },
      take: PENDING_PREVIEW_TAKE,
      select: { id: true, name: true },
    }),
  ])

  return { total, pending, planRequests, pendingPreview }
}

/** Destek talebi listesinin sunucu tarafı filtresi. Boş = filtre yok. */
export interface LeadFilters {
  /** Yalnız bu iş yerine bağlı destek talepleri. */
  supportWorkshopId?: string
}

/** Konsolun destek talebi satırındaki açılır listeleri besler. */
export interface SupportConsoleOptions {
  workshops: { value: string; label: string }[]
  admins: { value: string; label: string }[]
}

/** Yönetici adı — ad/soyad yoksa e-postaya düşer (her yönetici e-postalıdır). */
function adminLabel(user: {
  email: string | null
  firstName: string | null
  lastName: string | null
}): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
  return name || user.email || "—"
}

/** İş yeri bağlama ve atama listeleri. Yalnız etkin yöneticiler atanabilir. */
export async function getSupportConsoleOptions(): Promise<SupportConsoleOptions> {
  const [workshops, admins] = await Promise.all([
    prisma.workshop.findMany({ where: { kind: "customer" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.platformAdmin.findMany({
      where: { disabledAt: null },
      orderBy: { createdAt: "asc" },
      select: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    }),
  ])

  return {
    workshops: workshops.map((w) => ({ value: w.id, label: w.name })),
    admins: admins.map((a) => ({ value: a.user.id, label: adminLabel(a.user) })),
  }
}

/** Public demo + support leads, "new" first. Shared by ops home and leads page. */
export async function getLeadRows(filters: LeadFilters = {}): Promise<{
  demoRows: AdminDemoRequestRow[]
  supportRows: AdminSupportRequestRow[]
}> {
  const [demoRequests, supportRequests] = await Promise.all([
    prisma.demoRequest.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        businessName: true,
        phone: true,
        city: true,
        monthlyVehicles: true,
        notes: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.supportRequest.findMany({
      where: {
        OR: [{ workshopId: null }, { workshop: { kind: "customer" } }],
        ...(filters.supportWorkshopId ? { workshopId: filters.supportWorkshopId } : {}),
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        businessName: true,
        email: true,
        phone: true,
        subject: true,
        message: true,
        status: true,
        createdAt: true,
        // `internalNote` YALNIZ bu konsol sorgusunda seçilir; müşteri yüzeyleri
        // SupportRequest'i hiç okumaz (bkz. internal-note-visibility.test.ts).
        internalNote: true,
        workshopId: true,
        workshop: { select: { name: true } },
        assignedToUserId: true,
        assignedTo: { select: { email: true, firstName: true, lastName: true } },
      },
    }),
  ])

  const newFirst = <T extends { status: string }>(a: T, b: T) => {
    if (a.status === "new" && b.status !== "new") return -1
    if (b.status === "new" && a.status !== "new") return 1
    return 0
  }

  const demoRows: AdminDemoRequestRow[] = demoRequests
    .map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))
    .sort(newFirst)

  const supportRows: AdminSupportRequestRow[] = supportRequests
    .map(({ workshop, assignedTo, ...s }) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      workshopName: workshop?.name ?? null,
      assignedToLabel: assignedTo ? adminLabel(assignedTo) : null,
    }))
    .sort(newFirst)

  return { demoRows, supportRows }
}

export interface BillingData {
  orderRows: AdminOrderRow[]
  recentOrders: AdminOrderRow[]
  stuckTransactions: AdminStuckTxnRow[]
  subscriptions: AdminSubRow[]
  revenue: { activeCount: number; mrrLabel: string; monthLabel: string }
}

/** Son 15 (aktif/pasif fark etmez) siparişte gösterilecek deneme geçmişi. */
const RECENT_ORDER_TAKE = 15
/** Kartlı bir siparişte gösterilecek deneme geçmişi — aşırı veri çekmeyi önler. */
const TXN_HISTORY_TAKE = 5

type OrderWithTxns = {
  id: string
  workshop: { id: string; name: string; currentPeriodEnd: Date | null }
  type: string
  planTier: string
  billingCycle: string
  amountMinor: number
  status: string
  method: string
  confirmedByEmail: string | null
  reference: string
  billingSnapshot: unknown
  createdAt: Date
  paymentTransactions: Array<{
    id: string
    status: string
    maskedPan: string | null
    cardBrand: string | null
    errorCode: string | null
    correlationId: string | null
    createdAt: Date
  }>
}

function toTxnRow(t: OrderWithTxns["paymentTransactions"][number]): AdminTxnRow {
  return {
    id: t.id,
    status: t.status,
    maskedPan: t.maskedPan,
    cardBrand: t.cardBrand,
    errorCode: t.errorCode,
    correlationId: t.correlationId,
    createdAt: t.createdAt.toISOString(),
  }
}

function toOrderRow(o: OrderWithTxns): AdminOrderRow {
  const snap = (o.billingSnapshot ?? {}) as { invoiceTitle?: string; taxNumber?: string }
  const txnHistory = o.paymentTransactions.map(toTxnRow)
  return {
    id: o.id,
    workshopId: o.workshop.id,
    workshopName: o.workshop.name,
    type: o.type,
    planTier: o.planTier,
    billingCycle: o.billingCycle,
    amountLabel: formatMinor(o.amountMinor),
    reference: o.reference,
    invoiceTitle: snap.invoiceTitle ?? null,
    taxNumber: snap.taxNumber ?? null,
    createdAt: o.createdAt.toISOString(),
    method: o.method,
    status: o.status,
    confirmedByEmail: o.confirmedByEmail,
    periodEnd: o.workshop.currentPeriodEnd?.toISOString() ?? null,
    daysLeft: o.workshop.currentPeriodEnd
      ? Math.max(0, Math.ceil((o.workshop.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null,
    lastTxn: txnHistory[0] ?? null,
    txnHistory,
  }
}

/** Pending (+ son 15 confirmed/cancelled) siparişler, takılı kart ödemeleri,
 *  aktif abonelikler ve gelir özeti. Ops home (sayaçlar) ve billing sayfası
 *  paylaşıyor. Admin-taraflı: tenant filtresi yok, requireAdmin çağıran tarafta. */
export async function getBillingData(): Promise<BillingData> {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const orderInclude = {
    workshop: { select: { id: true, name: true, currentPeriodEnd: true } },
    paymentTransactions: { orderBy: { createdAt: "desc" as const }, take: TXN_HISTORY_TAKE },
  }
  const [pendingOrders, recentOrdersRaw, stuckTxns, monthOrders, activeWorkshops] = await Promise.all([
    prisma.billingOrder.findMany({
      where: { status: "pending_payment", workshop: { kind: "customer" } },
      orderBy: { createdAt: "desc" },
      include: orderInclude,
    }),
    prisma.billingOrder.findMany({
      where: { status: { in: ["confirmed", "cancelled"] }, workshop: { kind: "customer" } },
      orderBy: { createdAt: "desc" },
      take: RECENT_ORDER_TAKE,
      include: orderInclude,
    }),
    prisma.paymentTransaction.findMany({
      // purpose'tan BAĞIMSIZ: kart doğrulama denemeleri (card_verification) de
      // takılabilir (banka çekimi tamamlanmış ama activateVerifiedWorkshop hiç
      // tetiklenmemiş olabilir) — bu ekran artık iki purpose'u da kurtarır
      // (retryStuckActivation'daki purpose dalına bkz.).
      where: { status: "callback_received", workshopId: { not: INTERNAL_OPERATIONS_WORKSHOP_ID } },
      orderBy: { createdAt: "desc" },
      include: { billingOrder: { select: { reference: true, workshop: { select: { name: true } } } } },
    }),
    prisma.billingOrder.findMany({
      where: { status: "confirmed", confirmedAt: { gte: monthStart }, workshop: { kind: "customer" } },
      select: { amountMinor: true },
    }),
    prisma.workshop.findMany({
      where: { kind: "customer", subscriptionStatus: "active", currentPeriodEnd: { not: null } },
      select: { id: true, name: true, planTier: true, billingCycle: true, currentPeriodEnd: true },
    }),
  ])

  const orderRows: AdminOrderRow[] = pendingOrders.map(toOrderRow)
  const recentOrders: AdminOrderRow[] = recentOrdersRaw.map(toOrderRow)

  // card_verification denemelerinin billingOrder'ı yoktur (workshopId
  // denormalize) — workshop adını ayrı bir toplu sorguyla çözümle.
  const verifyWorkshopIds = [
    ...new Set(stuckTxns.filter((t) => t.purpose === "card_verification").map((t) => t.workshopId)),
  ]
  const verifyWorkshops = verifyWorkshopIds.length
    ? await prisma.workshop.findMany({ where: { kind: "customer", id: { in: verifyWorkshopIds } }, select: { id: true, name: true } })
    : []
  const verifyWorkshopNameById = new Map(verifyWorkshops.map((w) => [w.id, w.name]))

  const stuckTransactions: AdminStuckTxnRow[] = stuckTxns.flatMap((t): AdminStuckTxnRow[] => {
    if (t.purpose === "purchase") {
      // Tip daralt (asla `!`): billingOrderId/billingOrder eksikse (beklenmedik
      // veri tutarsızlığı) o satır sessizce atlanır, hatalı satır gösterilmez.
      if (t.billingOrderId == null || t.billingOrder == null) return []
      return [{
        id: t.id,
        purpose: "purchase",
        billingOrderId: t.billingOrderId,
        workshopName: t.billingOrder.workshop.name,
        reference: t.billingOrder.reference,
        providerOrderId: t.providerOrderId,
        amountLabel: formatMinor(t.amountMinor),
        createdAt: t.createdAt.toISOString(),
      }]
    }
    // card_verification: sipariş yok; workshop adı bulunamazsa (silinmiş/yarış) atla.
    const workshopName = verifyWorkshopNameById.get(t.workshopId)
    if (!workshopName) return []
    return [{
      id: t.id,
      purpose: "card_verification",
      billingOrderId: null,
      workshopName,
      reference: null,
      providerOrderId: t.providerOrderId,
      amountLabel: formatMinor(t.amountMinor),
      createdAt: t.createdAt.toISOString(),
    }]
  })

  const now = Date.now()
  const subscriptions: AdminSubRow[] = activeWorkshops.map((w) => {
    const end = w.currentPeriodEnd as Date
    return {
      id: w.id,
      name: w.name,
      planTier: w.planTier,
      billingCycle: w.billingCycle ?? null,
      periodEnd: end.toLocaleDateString("tr-TR"),
      daysLeft: Math.max(0, Math.ceil((end.getTime() - now) / 86_400_000)),
    }
  })

  const monthRevenueMinor = monthOrders.reduce((sum, o) => sum + o.amountMinor, 0)
  const mrrMinor = activeWorkshops.reduce((sum, w) => {
    const minor = getPlanPriceMinor(w.planTier as PlanTier, (w.billingCycle ?? "monthly") as BillingCycle)
    return sum + (w.billingCycle === "yearly" ? Math.round(minor / 12) : minor)
  }, 0)

  return {
    orderRows,
    recentOrders,
    stuckTransactions,
    subscriptions,
    revenue: {
      activeCount: subscriptions.length,
      mrrLabel: formatMinor(mrrMinor),
      monthLabel: formatMinor(monthRevenueMinor),
    },
  }
}

import { prisma } from "@/lib/db"
import { formatMinor, getPlanPriceMinor } from "@/lib/billing/pricing"
import type { PlanTier } from "@/lib/plan"
import type { BillingCycle } from "@prisma/client"
import type { AdminWorkshopRow } from "@/app/admin/admin-workshops"
import type { AdminDemoRequestRow, AdminSupportRequestRow } from "@/app/admin/admin-requests"
import type { AdminOrderRow, AdminSubRow, AdminTxnRow, AdminStuckTxnRow } from "@/app/admin/admin-billing"

/** Workshop list, ranked so actionable rows (pending approval, then upgrade
 *  requests) surface first. Shared by the ops home and the workshops page. */
export async function getWorkshopRows(): Promise<AdminWorkshopRow[]> {
  const workshops = await prisma.workshop.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      approvalStatus: true,
      subscriptionStatus: true,
      planTier: true,
      requestedPlanTier: true,
      trialEndsAt: true,
      extraSeats: true,
      createdAt: true,
      users: { select: { email: true }, take: 1, orderBy: { createdAt: "asc" } },
    },
  })

  const rows: AdminWorkshopRow[] = workshops.map((w) => ({
    id: w.id,
    name: w.name,
    ownerEmail: w.users[0]?.email ?? null,
    approvalStatus: w.approvalStatus,
    subscriptionStatus: w.subscriptionStatus,
    planTier: w.planTier,
    requestedPlanTier: w.requestedPlanTier,
    trialEndsAt: w.trialEndsAt ? w.trialEndsAt.toISOString() : null,
    extraSeats: w.extraSeats,
    createdAt: w.createdAt.toISOString(),
  }))

  const rank = (r: AdminWorkshopRow) =>
    r.approvalStatus === "pending" ? 0 : r.requestedPlanTier ? 1 : 2
  rows.sort((a, b) => rank(a) - rank(b))
  return rows
}

/** Public demo + support leads, "new" first. Shared by ops home and leads page. */
export async function getLeadRows(): Promise<{
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
    .map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))
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
  workshop: { name: string }
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
    workshop: { select: { name: true } },
    paymentTransactions: { orderBy: { createdAt: "desc" as const }, take: TXN_HISTORY_TAKE },
  }
  const [pendingOrders, recentOrdersRaw, stuckTxns, monthOrders, activeWorkshops] = await Promise.all([
    prisma.billingOrder.findMany({
      where: { status: "pending_payment" },
      orderBy: { createdAt: "desc" },
      include: orderInclude,
    }),
    prisma.billingOrder.findMany({
      where: { status: { in: ["confirmed", "cancelled"] } },
      orderBy: { createdAt: "desc" },
      take: RECENT_ORDER_TAKE,
      include: orderInclude,
    }),
    prisma.paymentTransaction.findMany({
      // purpose: "purchase" — kart doğrulama denemelerinin (card_verification)
      // billingOrderId'si yoktur; bu ekran yalnız sipariş aktivasyonu kurtarır
      // (bkz. Task 5: doğrulama takılmaları için ayrı dal).
      where: { status: "callback_received", purpose: "purchase" },
      orderBy: { createdAt: "desc" },
      include: { billingOrder: { select: { reference: true, workshop: { select: { name: true } } } } },
    }),
    prisma.billingOrder.findMany({
      where: { status: "confirmed", confirmedAt: { gte: monthStart } },
      select: { amountMinor: true },
    }),
    prisma.workshop.findMany({
      where: { subscriptionStatus: "active", currentPeriodEnd: { not: null } },
      select: { id: true, name: true, planTier: true, billingCycle: true, currentPeriodEnd: true },
    }),
  ])

  const orderRows: AdminOrderRow[] = pendingOrders.map(toOrderRow)
  const recentOrders: AdminOrderRow[] = recentOrdersRaw.map(toOrderRow)
  // where zaten purpose: "purchase" filtreli — billingOrderId/billingOrder her
  // zaman dolu olmalı; yine de tip daralt (asla `!`): filtre olmayan bir satır
  // gelirse sessizce atlanır (admin listesinden düşer, hatalı satır göstermez).
  const stuckTransactions: AdminStuckTxnRow[] = stuckTxns
    .filter((t): t is typeof t & { billingOrderId: string; billingOrder: NonNullable<typeof t.billingOrder> } =>
      t.billingOrderId != null && t.billingOrder != null)
    .map((t) => ({
      id: t.id,
      billingOrderId: t.billingOrderId,
      workshopName: t.billingOrder.workshop.name,
      reference: t.billingOrder.reference,
      providerOrderId: t.providerOrderId,
      amountLabel: formatMinor(t.amountMinor),
      createdAt: t.createdAt.toISOString(),
    }))

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

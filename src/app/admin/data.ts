import { prisma } from "@/lib/db"
import { formatMinor, getPlanPriceMinor } from "@/lib/billing/pricing"
import type { PlanTier } from "@/lib/plan"
import type { BillingCycle } from "@prisma/client"
import type { AdminWorkshopRow } from "@/app/admin/admin-workshops"
import type { AdminDemoRequestRow, AdminSupportRequestRow } from "@/app/admin/admin-requests"
import type { AdminOrderRow, AdminSubRow } from "@/app/admin/admin-billing"

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
  subscriptions: AdminSubRow[]
  revenue: { activeCount: number; mrrLabel: string; monthLabel: string }
}

/** Pending havale orders, active subscriptions, and revenue summary. Shared by
 *  the ops home (counts) and the billing page. */
export async function getBillingData(): Promise<BillingData> {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const [pendingOrders, monthOrders, activeWorkshops] = await Promise.all([
    prisma.billingOrder.findMany({
      where: { status: "pending_payment" },
      orderBy: { createdAt: "desc" },
      include: { workshop: { select: { name: true } } },
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

  const orderRows: AdminOrderRow[] = pendingOrders.map((o) => {
    const snap = (o.billingSnapshot ?? {}) as { invoiceTitle?: string; taxNumber?: string }
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
    }
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
    subscriptions,
    revenue: {
      activeCount: subscriptions.length,
      mrrLabel: formatMinor(mrrMinor),
      monthLabel: formatMinor(monthRevenueMinor),
    },
  }
}

import Link from "next/link"
import { ShieldCheck, Clock, Sparkles, PhoneIncoming, LifeBuoy } from "lucide-react"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { logoutAction } from "@/app/(auth)/login/actions"
import { AdminWorkshops, type AdminWorkshopRow } from "@/app/admin/admin-workshops"
import {
  AdminDemoRequests,
  AdminSupportRequests,
  type AdminDemoRequestRow,
  type AdminSupportRequestRow,
} from "@/app/admin/admin-requests"
import { AdminBilling, type AdminOrderRow, type AdminSubRow } from "@/app/admin/admin-billing"
import { formatMinor, getPlanPriceMinor } from "@/lib/billing/pricing"
import type { PlanTier } from "@/lib/plan"
import type { BillingCycle } from "@prisma/client"

export const metadata = { title: "Yönetim Paneli" }

// Always render fresh — this is an operational console.
export const dynamic = "force-dynamic"

// Bu force-dynamic server component her istekte bir kez render olur; saati
// render-saflık kuralının denetlemediği bir yardımcı üzerinden oku ki
// gün-sayacı "şimdi"yi yansıtsın (Date.now render gövdesinde uyarı veriyordu).
function currentEpochMs(): number {
  return Date.now()
}

export default async function AdminPage() {
  await requireAdmin()

  const [workshops, demoRequests, supportRequests, pendingOrders, monthOrders] = await Promise.all([
    prisma.workshop.findMany({
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
        billingCycle: true,
        currentPeriodEnd: true,
        users: { select: { email: true }, take: 1, orderBy: { createdAt: "asc" } },
      },
    }),
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
    prisma.billingOrder.findMany({
      where: { status: "pending_payment" },
      orderBy: { createdAt: "desc" },
      include: { workshop: { select: { name: true } } },
    }),
    prisma.billingOrder.findMany({
      where: { status: "confirmed", confirmedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
      select: { amountMinor: true },
    }),
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
    extraSeats: w.extraSeats,
    createdAt: w.createdAt.toISOString(),
  }))

  // Surface actionable items first: pending approvals, then upgrade requests.
  const rank = (r: AdminWorkshopRow) =>
    r.approvalStatus === "pending" ? 0 : r.requestedPlanTier ? 1 : 2
  rows.sort((a, b) => rank(a) - rank(b))

  const pendingCount = rows.filter((r) => r.approvalStatus === "pending").length
  const requestCount = rows.filter((r) => r.requestedPlanTier).length

  // Lead/support counts — "new" first (status asc puts "new" before others
  // alphabetically for both enums, but we sort explicitly to be safe).
  const demoRows: AdminDemoRequestRow[] = demoRequests
    .map((d) => ({
      id: d.id,
      name: d.name,
      businessName: d.businessName,
      phone: d.phone,
      city: d.city,
      monthlyVehicles: d.monthlyVehicles,
      notes: d.notes,
      status: d.status,
      createdAt: d.createdAt.toISOString(),
    }))
    .sort((a, b) => {
      if (a.status === "new" && b.status !== "new") return -1
      if (b.status === "new" && a.status !== "new") return 1
      return 0
    })

  const supportRows: AdminSupportRequestRow[] = supportRequests
    .map((s) => ({
      id: s.id,
      name: s.name,
      businessName: s.businessName,
      email: s.email,
      phone: s.phone,
      subject: s.subject,
      message: s.message,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
    }))
    .sort((a, b) => {
      if (a.status === "new" && b.status !== "new") return -1
      if (b.status === "new" && a.status !== "new") return 1
      return 0
    })

  const newDemoCount = demoRows.filter((r) => r.status === "new").length
  const newSupportCount = supportRows.filter((r) => r.status === "new").length

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

  const now = currentEpochMs()
  const subscriptions: AdminSubRow[] = workshops
    .filter((w) => w.subscriptionStatus === "active" && w.currentPeriodEnd)
    .map((w) => {
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

  // MRR: active subs normalized to monthly (yearly /12). Uses live catalog price.
  const monthRevenueMinor = monthOrders.reduce((sum, o) => sum + o.amountMinor, 0)
  const revenue = {
    activeCount: subscriptions.length,
    mrrLabel: formatMinor(
      workshops
        .filter((w) => w.subscriptionStatus === "active" && w.currentPeriodEnd)
        .reduce((sum, w) => {
          const minor = getPlanPriceMinor(w.planTier as PlanTier, (w.billingCycle ?? "monthly") as BillingCycle)
          return sum + (w.billingCycle === "yearly" ? Math.round(minor / 12) : minor)
        }, 0)
    ),
    monthLabel: formatMinor(monthRevenueMinor),
  }

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="size-5 text-primary" />
            BakimX Yönetim
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Uygulamaya dön
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="text-muted-foreground hover:text-foreground">
                Çıkış
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">İş Yerleri</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Kayıtları onaylayın, paket taleplerini etkinleştirin.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm">
            <Clock className="size-4 text-amber-600" />
            <span className="font-semibold text-foreground">{pendingCount}</span>
            <span className="text-muted-foreground">onay bekliyor</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm">
            <Sparkles className="size-4 text-primary" />
            <span className="font-semibold text-foreground">{requestCount}</span>
            <span className="text-muted-foreground">paket talebi</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm">
            <span className="font-semibold text-foreground">{rows.length}</span>
            <span className="text-muted-foreground">toplam iş yeri</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm">
            <PhoneIncoming className="size-4 text-primary" />
            <span className="font-semibold text-foreground">{newDemoCount}</span>
            <span className="text-muted-foreground">yeni demo talebi</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm">
            <LifeBuoy className="size-4 text-primary" />
            <span className="font-semibold text-foreground">{newSupportCount}</span>
            <span className="text-muted-foreground">yeni destek talebi</span>
          </div>
        </div>

        <AdminWorkshops workshops={rows} />

        <div className="space-y-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Faturalandırma</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Havaleleri teyit edin, abonelikleri ve geliri görün.</p>
          </div>
          <AdminBilling orders={orderRows} subscriptions={subscriptions} revenue={revenue} />
        </div>

        <div className="space-y-3 pt-2">
          <div>
            <h2 className="text-lg font-bold text-foreground">Demo Talepleri</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Public demo talepleri. Yeni olanlar üstte.
            </p>
          </div>
          <AdminDemoRequests requests={demoRows} />
        </div>

        <div className="space-y-3 pt-2">
          <div>
            <h2 className="text-lg font-bold text-foreground">Destek Talepleri</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Public destek talepleri. Yeni olanlar üstte.
            </p>
          </div>
          <AdminSupportRequests requests={supportRows} />
        </div>
      </main>
    </div>
  )
}

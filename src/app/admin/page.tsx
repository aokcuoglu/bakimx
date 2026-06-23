import Link from "next/link"
import { ShieldCheck, Clock, Sparkles } from "lucide-react"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { logoutAction } from "@/app/(auth)/login/actions"
import { AdminWorkshops, type AdminWorkshopRow } from "@/app/admin/admin-workshops"

export const metadata = { title: "Yönetim Paneli" }

// Always render fresh — this is an operational console.
export const dynamic = "force-dynamic"

export default async function AdminPage() {
  await requireAdmin()

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

  // Surface actionable items first: pending approvals, then upgrade requests.
  const rank = (r: AdminWorkshopRow) =>
    r.approvalStatus === "pending" ? 0 : r.requestedPlanTier ? 1 : 2
  rows.sort((a, b) => rank(a) - rank(b))

  const pendingCount = rows.filter((r) => r.approvalStatus === "pending").length
  const requestCount = rows.filter((r) => r.requestedPlanTier).length

  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="size-5 text-primary" />
            BakimX Yönetim
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/app" className="text-muted-foreground hover:text-foreground">
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

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 space-y-6">
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
        </div>

        <AdminWorkshops workshops={rows} />
      </main>
    </div>
  )
}

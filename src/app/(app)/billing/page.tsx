import Link from "next/link"
import { Clock, CheckCircle2, Users } from "lucide-react"
import { AppShell } from "@/components/app/app-shell"
import { getAppData } from "@/app/(app)/data"
import { getPlanState, getSeatLimit, type PlanTier } from "@/lib/plan"
import { getSeatUsage } from "@/lib/rbac"
import { getPlanPackage } from "@/lib/plans-catalog"
import { PlanPackages } from "@/components/app/plan-packages"
import { PendingOrderAlert } from "@/components/billing/pending-order-alert"
import { prisma } from "@/lib/db"
import { formatMinor } from "@/lib/billing/pricing"

export const metadata = { title: "Paket & Abonelik" }

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ pendingBlocked?: string }>
}) {
  const { workshop } = await getAppData()
  const sp = await searchParams

  if (!workshop) {
    return (
      <AppShell pageTitle="Paket & Abonelik">
        <div className="text-center py-12 text-muted-foreground">
          <p>İş yeri bilgisi bulunamadı</p>
        </div>
      </AppShell>
    )
  }

  const plan = getPlanState(workshop)
  const pendingOrder = await prisma.billingOrder.findFirst({
    where: { workshopId: workshop.id, status: "pending_payment" },
    orderBy: { createdAt: "desc" },
  })
  const lastConfirmedOrder = await prisma.billingOrder.findFirst({
    where: { workshopId: workshop.id, status: "confirmed" },
    orderBy: { confirmedAt: "desc" },
  })
  const ownedTier = workshop.subscriptionStatus === "active" ? (workshop.planTier as PlanTier) : null
  const ownedPkg = ownedTier ? getPlanPackage(ownedTier) : null

  const seatUsage = await getSeatUsage(workshop.id)
  const seatLimit = getSeatLimit(workshop.planTier as PlanTier, workshop.extraSeats)
  const seatsAtLimit = seatUsage.used >= seatLimit

  return (
    <AppShell workshopName={workshop.name} pageTitle="Paket & Abonelik">
      {sp.pendingBlocked === "1" && pendingOrder && (
        <PendingOrderAlert reference={pendingOrder.reference} />
      )}
      <div className="space-y-6">
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">Ana Panel</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Paket &amp; Abonelik</span>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Paket &amp; Abonelik</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            İş yerinize uygun paketi seçin. İhtiyacınız değiştikçe yükseltebilirsiniz.
          </p>
        </div>

        {pendingOrder && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
            <Clock className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                Bekleyen ödeme · {getPlanPackage(pendingOrder.planTier)?.name} ({pendingOrder.billingCycle === "monthly" ? "Aylık" : "Yıllık"}) · {formatMinor(pendingOrder.amountMinor)}
              </p>
              <p className="text-muted-foreground mt-0.5">
                Havale açıklamasına <span className="font-semibold">{pendingOrder.reference}</span> yazın. Ödemeniz teyit edilince paketiniz aktifleşecek.
              </p>
            </div>
          </div>
        )}

        {/* Current status */}
        {plan.isTrialing ? (
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <Clock className="size-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                Ücretsiz deneme · {plan.trialDaysLeft} gün kaldı
              </p>
              <p className="text-muted-foreground mt-0.5">
                Deneme süreniz boyunca tüm özellikler açık. Kesintisiz devam için bir paket seçin.
              </p>
            </div>
          </div>
        ) : ownedPkg ? (
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <CheckCircle2 className="size-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Aktif paket: {ownedPkg.name}</p>
              <p className="text-muted-foreground mt-0.5">
                Aboneliğiniz aktif. Daha fazla özellik için paketinizi yükseltebilirsiniz.
              </p>
              {lastConfirmedOrder && (
                <a
                  href={`/api/billing/orders/${lastConfirmedOrder.id}/receipt`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Son ödeme makbuzunu görüntüle
                </a>
              )}
            </div>
          </div>
        ) : null}

        {/* Seat usage */}
        <div className="flex items-start gap-3 rounded-lg border bg-card p-4">
          <Users className="size-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm flex-1">
            <p className="font-medium text-foreground">
              Koltuk kullanımı: {seatUsage.used} / {seatLimit}
            </p>
            <p className="text-muted-foreground mt-0.5">
              {seatUsage.activeUsers} aktif kullanıcı
              {seatUsage.pendingInvites > 0 && `, ${seatUsage.pendingInvites} bekleyen davet`}
              {workshop.extraSeats > 0 && ` · ${workshop.extraSeats} ek koltuk dahil`}.
              {seatsAtLimit && " Limit dolu — yükseltin veya ek koltuk için iletişime geçin."}
            </p>
          </div>
          <Link href="/settings?tab=team" className="text-sm text-primary hover:underline shrink-0">
            Ekibi yönet
          </Link>
        </div>

        <PlanPackages
          ownedTier={ownedTier}
          workshopName={workshop.name}
          hasPendingOrder={!!pendingOrder}
        />
      </div>
    </AppShell>
  )
}

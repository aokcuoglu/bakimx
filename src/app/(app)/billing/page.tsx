import Link from "next/link"
import { Clock } from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { getAppData } from "@/app/(app)/data"
import { PLAN_SEATS, getPlanState, hasFeature, type PlanTier } from "@/lib/plan"
import { canManageBilling, getSeatUsage } from "@/lib/rbac"
import { getPlanPackage } from "@/lib/plans-catalog"
import { PlanPackages } from "@/components/billing/plan-packages"
import { BillingUsageCards } from "@/components/billing/usage-cards"
import { PendingOrderAlert } from "@/components/billing/pending-order-alert"
import { prisma } from "@/lib/db"
import { formatMinor } from "@/lib/billing/pricing"
import { getWorkshopQuotaContext, getWorkshopQuotaUsage } from "@/lib/rapidapi-quota"

export const metadata = { title: "Paketler & Kullanım" }

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ pendingBlocked?: string }>
}) {
  const { user, workshop } = await getAppData()
  const sp = await searchParams

  if (!workshop) {
    return (
      <AppShell pageTitle="Paketler & Kullanım">
        <div className="text-center py-12 text-muted-foreground">
          <p>İş yeri bilgisi bulunamadı</p>
        </div>
      </AppShell>
    )
  }

  const plan = getPlanState(workshop)
  const quotaContext = getWorkshopQuotaContext(workshop)
  const [pendingOrder, lastConfirmedOrder, seatUsage, quotaUsage] = await Promise.all([
    prisma.billingOrder.findFirst({
      where: { workshopId: workshop.id, status: "pending_payment" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.billingOrder.findFirst({
      where: { workshopId: workshop.id, status: "confirmed" },
      orderBy: { confirmedAt: "desc" },
    }),
    getSeatUsage(workshop.id),
    getWorkshopQuotaUsage(quotaContext),
  ])
  const ownedTier = workshop.subscriptionStatus === "active" ? (workshop.planTier as PlanTier) : null
  const ownedPkg = ownedTier ? getPlanPackage(ownedTier) : null
  const canPurchase = canManageBilling(user.role)

  return (
    <AppShell workshopName={workshop.name} pageTitle="Paketler & Kullanım">
      {sp.pendingBlocked === "1" && pendingOrder && (
        <PendingOrderAlert reference={pendingOrder.reference} method={pendingOrder.method} />
      )}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">Ana Panel</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Paketler &amp; Kullanım</span>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Paketler &amp; Kullanım</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Mevcut haklarınızı ve bu ayki gerçek kullanımınızı görün; paketleri aynı katalogdan karşılaştırın.
          </p>
        </div>

        {pendingOrder && (
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
            <Clock className="size-5 text-warning-strong shrink-0 mt-0.5" />
            <div className="text-sm flex-1">
              <p className="font-medium text-foreground">
                Bekleyen ödeme · {getPlanPackage(pendingOrder.planTier)?.name} ({pendingOrder.billingCycle === "monthly" ? "Aylık" : "Yıllık"}) · {formatMinor(pendingOrder.amountMinor)}
              </p>
              {pendingOrder.method === "card" ? (
                <>
                  <p className="text-muted-foreground mt-0.5">
                    Başlattığınız kart ödemesi henüz tamamlanmadı. Ödemenizi tamamlamak için devam edin.
                  </p>
                  <Link
                    href={`/payment/result?ref=${encodeURIComponent(pendingOrder.reference)}`}
                    className="mt-2 inline-flex h-8 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                  >
                    Ödemeye devam et
                  </Link>
                </>
              ) : (
                <p className="text-muted-foreground mt-0.5">
                  Havale açıklamasına <span className="font-semibold">{pendingOrder.reference}</span> yazın. Ödemeniz teyit edilince paketiniz aktifleşecek.
                </p>
              )}
            </div>
          </div>
        )}

        <BillingUsageCards
          plan={plan}
          planName={ownedPkg?.name ?? getPlanPackage(plan.tier)?.name ?? plan.tier}
          billingCycle={workshop.billingCycle}
          seatUsage={seatUsage}
          includedSeats={PLAN_SEATS[plan.accessTier]}
          extraSeats={Math.max(0, workshop.extraSeats)}
          quota={quotaUsage}
          photoEnabled={hasFeature(plan.accessTier, "photoChecklist")}
          canPurchase={canPurchase}
          receiptHref={lastConfirmedOrder ? `/api/billing/orders/${lastConfirmedOrder.id}/receipt` : undefined}
        />

        <div id="paketler" className="scroll-mt-24 pt-2">
          <PlanPackages
            ownedTier={ownedTier}
            workshopName={workshop.name}
            hasPendingOrder={!!pendingOrder}
            canPurchase={canPurchase}
          />
        </div>
      </div>
    </AppShell>
  )
}

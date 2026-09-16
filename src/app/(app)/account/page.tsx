import Link from "next/link"
import { Clock } from "lucide-react"
import type { BillingOrder } from "@prisma/client"
import { getAppData } from "@/app/(app)/data"
import { prisma } from "@/lib/db"
import { ROLE_LABELS } from "@/lib/roles"
import { isTechnicianRestrictedRole } from "@/lib/technician-route-access"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { AccountProfileForm } from "@/components/account/account-profile-form"
import { AccountPasswordForm } from "@/components/account/account-password-form"
import { BillingUsageCards } from "@/components/billing/usage-cards"
import { BillingPlanManager } from "@/components/billing/billing-plan-manager"
import { PendingOrderAlert } from "@/components/billing/pending-order-alert"
import { PLAN_SEATS, getPlanState, hasFeature, type PlanTier } from "@/lib/plan"
import { canManageBilling, getSeatUsage } from "@/lib/rbac"
import { getPlanPackage } from "@/lib/plans-catalog"
import { formatMinor } from "@/lib/billing/pricing"
import { getHavaleInstructions } from "@/lib/billing/provider"
import { isLiteRegistrationOpen } from "@/lib/lite-campaign"
import { getWorkshopQuotaContext, getWorkshopQuotaUsage } from "@/lib/rapidapi-quota"

export const metadata = { title: "Hesabım" }

export default async function AccountPage({ searchParams }: {
  searchParams: Promise<{ pendingBlocked?: string }>
}) {
  const { user, workshop } = await getAppData()
  const sp = await searchParams
  // /account is also available to technician roles. Keep the old /billing
  // visibility boundary while moving billing information onto this page.
  const canViewBilling = !!workshop && !isTechnicianRestrictedRole(user.role)
  const plan = canViewBilling && workshop ? getPlanState(workshop) : null
  const billing = canViewBilling && workshop
    ? await Promise.all([
        prisma.billingOrder.findFirst({
          where: { workshopId: workshop.id, status: "pending_payment" },
          orderBy: { createdAt: "desc" },
        }),
        prisma.billingOrder.findFirst({
          where: { workshopId: workshop.id, status: "confirmed" },
          orderBy: { confirmedAt: "desc" },
        }),
        getSeatUsage(workshop.id),
        getWorkshopQuotaUsage(getWorkshopQuotaContext(workshop)),
      ])
    : null
  const [pendingOrder, lastConfirmedOrder, seatUsage, quotaUsage] = billing ?? [null, null, null, null]
  const ownedTier = workshop?.subscriptionStatus === "active" ? (workshop.planTier as PlanTier) : null
  const planName = plan ? getPlanPackage(ownedTier ?? plan.tier)?.name ?? plan.tier : ""
  const canPurchase = canManageBilling(user.role)

  return (
    <AppShell pageTitle="Hesabım" wide={canViewBilling} constrained={!canViewBilling}>
      {sp.pendingBlocked === "1" && pendingOrder && (
        <PendingOrderAlert reference={pendingOrder.reference} method={pendingOrder.method} />
      )}
      <div className="space-y-8 sm:space-y-10">
        <div className="max-w-3xl space-y-4 sm:space-y-6">
          <section className="rounded-lg border border-border bg-card p-4 sm:p-6">
            <h2 className="mb-4 text-base font-semibold text-foreground">Profil Bilgileri</h2>
            <AccountProfileForm firstName={user.firstName ?? ""} lastName={user.lastName ?? ""} />
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              {(user.email || user.username) && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">{user.email ? "E-posta" : "Kullanıcı adı"}</span>
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">{user.email || user.username}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Rol</span>
                <span className="text-sm font-medium text-foreground">{ROLE_LABELS[user.role]}</span>
              </div>
              {workshop && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">İş Yeri</span>
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">{workshop.name}</span>
                </div>
              )}
            </div>
          </section>
          <section className="rounded-lg border border-border bg-card p-4 sm:p-6">
            <h2 className="mb-4 text-base font-semibold text-foreground">Şifre Değiştir</h2>
            <AccountPasswordForm />
          </section>
        </div>

        {plan && workshop && seatUsage && quotaUsage && (
          <section id="paket" aria-labelledby="paket-baslik" className="scroll-mt-24 space-y-5 border-t border-border pt-8 sm:space-y-6">
            <div>
              <h2 id="paket-baslik" className="text-xl font-semibold text-foreground sm:text-2xl">Paket ve kullanım</h2>
              <p className="mt-1 text-sm text-muted-foreground">Mevcut haklarınızı, kullanımınızı ve paket seçeneklerini hesabınızdan yönetin.</p>
            </div>
            {pendingOrder && <PendingPaymentNotice order={pendingOrder} />}
            <BillingUsageCards
              plan={plan}
              planName={planName}
              billingCycle={workshop.billingCycle}
              seatUsage={seatUsage}
              includedSeats={PLAN_SEATS[plan.accessTier]}
              extraSeats={Math.max(0, workshop.extraSeats)}
              quota={quotaUsage}
              photoEnabled={hasFeature(plan.accessTier, "photoChecklist")}
              canPurchase={canPurchase}
              receiptHref={lastConfirmedOrder ? `/api/billing/orders/${lastConfirmedOrder.id}/receipt` : undefined}
            />
            <BillingPlanManager
              ownedTier={ownedTier}
              currentPlanName={planName}
              currentCycle={workshop.billingCycle}
              isTrialing={plan.isTrialing}
              trialDaysLeft={plan.trialDaysLeft}
              workshopName={workshop.name}
              hasPendingOrder={!!pendingOrder}
              pendingReference={pendingOrder?.reference}
              pendingMethod={pendingOrder?.method}
              canPurchase={canPurchase}
              liteRegistrationOpen={isLiteRegistrationOpen()}
              liteFreeGranted={!!workshop.liteFreeGrantedAt}
              defaultInvoiceTitle={workshop.invoiceTitle || workshop.name}
              defaultTaxNumber={workshop.taxNumber || ""}
              defaultTaxOffice={workshop.taxOffice || ""}
              seatUsage={seatUsage}
              extraSeats={Math.max(0, workshop.extraSeats)}
              havale={getHavaleInstructions()}
            />
          </section>
        )}
      </div>
    </AppShell>
  )
}

function PendingPaymentNotice({ order }: { order: BillingOrder }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
      <Clock className="mt-0.5 size-5 shrink-0 text-warning-strong" aria-hidden="true" />
      <div className="flex-1 text-sm">
        <p className="font-medium text-foreground">
          Bekleyen ödeme · {getPlanPackage(order.planTier)?.name} ({order.billingCycle === "monthly" ? "Aylık" : "Yıllık"}) · {formatMinor(order.amountMinor)}
        </p>
        {order.method === "card" ? (
          <>
            <p className="mt-0.5 text-muted-foreground">Başlattığınız kart ödemesi henüz tamamlanmadı.</p>
            <Button variant="foreground" size="compact" className="mt-2" asChild>
              <Link href={`/payment/result?ref=${encodeURIComponent(order.reference)}`}>Ödemeye devam et</Link>
            </Button>
          </>
        ) : (
          <p className="mt-0.5 text-muted-foreground">
            Havale açıklamasına <span className="font-semibold">{order.reference}</span> yazın. Ödemeniz teyit edilince paketiniz aktifleşecek.
          </p>
        )}
      </div>
    </div>
  )
}

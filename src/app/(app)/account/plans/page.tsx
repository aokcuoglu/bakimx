import { AppShell } from "@/components/layout/app-shell"
import { BillingPlanManager } from "@/components/billing/billing-plan-manager"
import { PendingPaymentNotice } from "@/components/billing/pending-payment-notice"
import { getAccountBillingContext } from "@/lib/billing/account-context"
import { getHavaleInstructions } from "@/lib/billing/provider"
import { isLiteRegistrationOpen } from "@/lib/lite-campaign"

export const metadata = { title: "Paketler" }

export default async function AccountPlansPage() {
  const { workshop, plan, ownedTier, planName, pendingOrder, seatUsage, canPurchase } = await getAccountBillingContext()

  return (
    <AppShell pageTitle="Paketler" wide>
      <div className="space-y-7">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Paketler</h1>
          <p className="mt-1 text-sm text-muted-foreground">Mevcut paketinizi görün; fiyatları, limitleri ve özellikleri karşılaştırın.</p>
        </header>
        {pendingOrder && <PendingPaymentNotice order={pendingOrder} />}
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
      </div>
    </AppShell>
  )
}

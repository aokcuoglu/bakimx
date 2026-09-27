import { AppShell } from "@/components/layout/app-shell"
import { BillingPlanManager } from "@/components/billing/billing-plan-manager"
import { PendingPaymentNotice } from "@/components/billing/pending-payment-notice"
import { getAccountBillingContext } from "@/lib/billing/account-context"
import { getHavaleInstructions } from "@/lib/billing/provider"
import { isLiteRegistrationOpen } from "@/lib/lite-campaign"
import { getReferralDiscountBps } from "@/lib/billing/referral-discount"

export const metadata = { title: "Paketler" }

export default async function SettingsPlansPage() {
  const { workshop, plan, ownedTier, planName, pendingOrder, seatUsage, canPurchase } = await getAccountBillingContext()

  return (
    <AppShell pageTitle="Paketler" wide workshopName={workshop.name}>
      <div className="space-y-7">
        {pendingOrder && <PendingPaymentNotice canPurchase={canPurchase} order={{
          planTier: pendingOrder.planTier,
          billingCycle: pendingOrder.billingCycle,
          amountMinor: pendingOrder.amountMinor,
          method: pendingOrder.method,
          reference: pendingOrder.reference,
        }} />}
        <BillingPlanManager
          ownedTier={ownedTier}
          currentPlanName={planName}
          currentCycle={workshop.billingCycle}
          currentPeriodEnd={workshop.currentPeriodEnd}
          isTrialing={plan.isTrialing}
          trialDaysLeft={plan.trialDaysLeft}
          workshopName={workshop.name}
          hasPendingOrder={!!pendingOrder}
          pendingReference={pendingOrder?.reference}
          pendingMethod={pendingOrder?.method}
          pendingAmountMinor={pendingOrder?.amountMinor}
          pendingPlanTier={pendingOrder?.planTier}
          pendingCycle={pendingOrder?.billingCycle}
          canPurchase={canPurchase}
          liteRegistrationOpen={isLiteRegistrationOpen()}
          liteFreeGranted={!!workshop.liteFreeGrantedAt}
          defaultInvoiceTitle={workshop.invoiceTitle || workshop.name}
          defaultTaxNumber={workshop.taxNumber || ""}
          defaultTaxOffice={workshop.taxOffice || ""}
          seatUsage={seatUsage}
          extraSeats={Math.max(0, workshop.extraSeats)}
          havale={getHavaleInstructions()}
          referralDiscountBps={getReferralDiscountBps(workshop)}
        />
      </div>
    </AppShell>
  )
}

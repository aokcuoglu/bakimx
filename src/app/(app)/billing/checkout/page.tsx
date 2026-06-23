import { AppShell } from "@/components/app/app-shell"
import { getAppData } from "@/app/(app)/data"
import { PurchaseWizard } from "@/components/billing/purchase-wizard"
import { getHavaleInstructions } from "@/lib/billing/provider"
import type { PlanTier } from "@/lib/plan"

export const metadata = { title: "Satın Al" }

const HAVALE = getHavaleInstructions()

export default async function BillingCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; cycle?: string }>
}) {
  const { workshop } = await getAppData()
  const sp = await searchParams
  const tier = (["starter", "pro", "premium"].includes(sp.tier ?? "") ? sp.tier : "pro") as PlanTier
  const cycle = (sp.cycle === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly"

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Satın Al">
      <PurchaseWizard
        mode="inapp"
        initialTier={tier}
        initialCycle={cycle}
        havale={HAVALE}
        defaultInvoiceTitle={workshop?.invoiceTitle || workshop?.name || ""}
      />
    </AppShell>
  )
}

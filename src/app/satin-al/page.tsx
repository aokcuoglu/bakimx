import { PurchaseWizard } from "@/components/billing/purchase-wizard"
import { getHavaleInstructions } from "@/lib/billing/provider"
import type { PlanTier } from "@/lib/plan"

export const metadata = { title: "Satın Al" }

const HAVALE = getHavaleInstructions()

export default async function SatinAlPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; cycle?: string }>
}) {
  const sp = await searchParams
  const tier = (["starter", "pro", "premium"].includes(sp.tier ?? "") ? sp.tier : "pro") as PlanTier
  const cycle = (sp.cycle === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly"

  // Premium, odaklı checkout: landing Header/Footer yerine tam ekran markalı split.
  // Marka + yasal linkler sol BrandRail içinde yaşar.
  return (
    <main className="min-h-[100dvh] bg-background">
      <PurchaseWizard mode="public" initialTier={tier} initialCycle={cycle} havale={HAVALE} />
    </main>
  )
}

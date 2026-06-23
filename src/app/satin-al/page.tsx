import { Header } from "@/components/sections/Header"
import { Footer } from "@/components/sections/Footer"
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

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-12">
        <PurchaseWizard mode="public" initialTier={tier} initialCycle={cycle} havale={HAVALE} />
      </main>
      <Footer />
    </>
  )
}

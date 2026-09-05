import { PurchaseWizard } from "@/components/billing/purchase-wizard"
import { getHavaleInstructions } from "@/lib/billing/provider"
import { isSalePlanTier } from "@/lib/plan"
import { PRIVATE_ROBOTS } from "@/lib/seo"
import { prisma } from "@/lib/db"

export const metadata = { title: "Satın Al", robots: PRIVATE_ROBOTS }

const HAVALE = getHavaleInstructions()

export default async function SatinAlPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string | string[]; cycle?: string | string[] }>
}) {
  const sp = await searchParams
  const tier = isSalePlanTier(sp.tier) ? sp.tier : "pro"
  const cycle = (sp.cycle === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly"

  // Premium, odaklı checkout: landing Header/Footer yerine tam ekran markalı split.
  // Marka + yasal linkler sol BrandRail içinde yaşar.
  const advisors = await prisma.salesAdvisor.findMany({ where: { disabledAt: null }, include: { user: { select: { firstName: true, lastName: true, email: true } } }, orderBy: { createdAt: "asc" } })
  return (
    <main className="min-h-[100dvh] bg-background">
      <PurchaseWizard mode="public" initialTier={tier} initialCycle={cycle} havale={HAVALE} advisors={advisors.map((a) => ({ id: a.id, label: [a.user.firstName, a.user.lastName].filter(Boolean).join(" ") || a.user.email || "—" }))} />
    </main>
  )
}

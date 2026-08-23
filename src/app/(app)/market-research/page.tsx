import { notFound } from "next/navigation"
import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import { MarketResearchWorkspace } from "@/components/market-research/market-research-workspace"
import { resolveFeature } from "@/lib/features"
import { type PlanTier } from "@/lib/plan"

export default async function MarketResearchPage() {
  const { user, workshop } = await getAppData()
  if (!workshop || !(await resolveFeature(workshop.id, workshop.planTier as PlanTier, "marketResearch"))) notFound()

  return (
    <AppShell pageTitle="Piyasa Araştırması" constrained showGlobalSearch={false}>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Piyasa Araştırması</h1>
          <p className="mt-1 text-sm text-muted-foreground">Parça seçeneklerini güncel web kaynaklarıyla karşılaştırın.</p>
        </div>
        <MarketResearchWorkspace canManageCredential={user.role === "owner"} />
      </div>
    </AppShell>
  )
}

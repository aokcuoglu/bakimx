import { NextResponse } from "next/server"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { resolveFeature } from "@/lib/features"
import { getWorkshopMarketResearchUsage } from "@/lib/market-research/usage"
import type { PlanTier } from "@/lib/plan"

export async function GET() {
  const { user, workshop } = await getCurrentUserWithWorkshop()
  if (!(await resolveFeature(workshop.id, workshop.planTier as PlanTier, "marketResearch"))) {
    return NextResponse.json({ error: "Piyasa araştırması yalnızca Premium pakette kullanılabilir." }, { status: 403 })
  }
  const usage = await getWorkshopMarketResearchUsage(workshop.id)
  return NextResponse.json({ ...usage, credential: { ...usage.credential, canManage: user.role === "owner" } })
}

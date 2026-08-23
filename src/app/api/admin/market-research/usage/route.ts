import { NextResponse } from "next/server"
import { requireAdminCapability } from "@/lib/admin"
import { getAdminMarketResearchUsage } from "@/lib/market-research/usage"

export async function GET() {
  await requireAdminCapability("viewHealth")
  return NextResponse.json(await getAdminMarketResearchUsage())
}

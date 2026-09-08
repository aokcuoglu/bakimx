"use server"

import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { canClaimMarketingConversions, claimRecordedMarketingConversions } from "@/lib/marketing-conversion-outbox"
import type { MarketingEventDetail } from "@/lib/marketing-analytics"

/** At-most-once handoff to the existing browser adapter, scoped to the owner. */
export async function claimMarketingConversions(): Promise<MarketingEventDetail[]> {
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true") return []
  const user = await getCurrentUser()
  if (!canClaimMarketingConversions(user)) return []
  return prisma.$transaction((tx) => claimRecordedMarketingConversions(tx, user))
}

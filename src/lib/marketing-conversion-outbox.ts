import { createHash } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { sanitizeMarketingAttribution, sanitizeMarketingPayload, type MarketingEventDetail, type MarketingEventPayloads } from "@/lib/marketing-analytics"

export type ConversionName = "lite_registered" | "first_work_order_created" | "paid_subscription_confirmed"
export const CONVERSION_ENTITY = "MarketingConversion"
export function conversionId(name: ConversionName, key: string) {
  return `marketing_${createHash("sha256").update(`${name}:${key}`).digest("hex")}`
}

/** Call within the business transaction: rollback also removes the conversion. */
export async function recordMarketingConversion<N extends ConversionName>(
  tx: Prisma.TransactionClient,
  input: { name: N; workshopId: string; key: string; payload: MarketingEventPayloads[N]; attribution?: unknown },
) {
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true") return
  const attribution = sanitizeMarketingAttribution(input.attribution)
  const id = conversionId(input.name, input.key)
  const params = sanitizeMarketingPayload(input.name, {
    source_page: input.name === "lite_registered" ? "/register" : input.name === "first_work_order_created" ? "/orders" : "/account/plans",
    ...input.payload,
    event_id: id,
    ...(attribution.campaignSource ? { campaign_source: attribution.campaignSource } : {}),
    ...(attribution.campaignMedium ? { campaign_medium: attribution.campaignMedium } : {}),
    ...(attribution.campaignName ? { campaign_name: attribution.campaignName } : {}),
    ...(attribution.landingPage ? { source_page: attribution.landingPage } : {}),
  })
  await tx.auditLog.createMany({
    data: [{ id, workshopId: input.workshopId, entityType: CONVERSION_ENTITY, entityId: id, action: input.name, metadataJson: JSON.stringify({ name: input.name, params: { ...params, event_version: 1 } }) }],
    skipDuplicates: true,
  })
}

export async function recordFirstWorkOrderConversion(tx: Prisma.TransactionClient, workshopId: string) {
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true") return
  if (await tx.serviceOrder.count({ where: { workshopId } }) !== 1) return
  const workshop = await tx.workshop.findUnique({ where: { id: workshopId }, select: { planTier: true } })
  if (!workshop) return
  await recordMarketingConversion(tx, { name: "first_work_order_created", key: workshopId, workshopId, payload: { plan_tier: workshop.planTier } })
}


type ConversionViewer = { workshopId: string; role: string; impersonatorAdminId?: string; mustChangePassword: boolean } | null
export function canClaimMarketingConversions(user: ConversionViewer): boolean {
  return process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true" && !!user && user.role === "owner" && !user.impersonatorAdminId && !user.mustChangePassword
}

/** Caller supplies the authenticated user, never request-provided tenant fields. */
export async function claimRecordedMarketingConversions(tx: Prisma.TransactionClient, user: ConversionViewer): Promise<MarketingEventDetail[]> {
  if (!canClaimMarketingConversions(user) || !user) return []
  const records = await tx.auditLog.findMany({ where: { workshopId: user.workshopId, entityType: CONVERSION_ENTITY }, orderBy: { createdAt: "asc" } })
  const events: MarketingEventDetail[] = []
  for (const record of records) {
    if (!record.metadataJson) continue
    const detail = JSON.parse(record.metadataJson) as MarketingEventDetail
    const claim = await tx.auditLog.createMany({ data: [{ id: `${record.id}_claimed`, workshopId: user.workshopId, entityType: "MarketingConversionClaim", entityId: record.id, action: "claimed" }], skipDuplicates: true })
    if (claim.count === 1) events.push(detail)
  }
  return events
}

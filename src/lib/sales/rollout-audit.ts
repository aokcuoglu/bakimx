export const SALES_ROLLOUT_AUDIT_CATEGORIES = [
  "advisor_customer_tenant_conflict",
  "won_lead_without_workshop",
  "converted_lead_missing_advisor",
  "sales_workshop_missing_advisor",
  "lead_workshop_source_mismatch",
  "lead_workshop_attribution_mismatch",
  "registration_link_attribution_mismatch",
  "billing_tax_snapshot_invalid",
  "legacy_manual_commission",
  "commission_snapshot_incomplete",
] as const

export type SalesRolloutAuditCategory = typeof SALES_ROLLOUT_AUDIT_CATEGORIES[number]
export type SalesRolloutAuditSeverity = "error" | "warning" | "info"

export type SalesRolloutAuditFinding = {
  category: SalesRolloutAuditCategory
  severity: SalesRolloutAuditSeverity
  entity: "SalesAdvisor" | "SalesLead" | "BillingOrder" | "SalesCommission"
  id: string
  relatedIds: string[]
  detail: string
}

export type SalesRolloutAuditSnapshot = {
  advisors: Array<{
    id: string
    userId: string
    userRole: string
    workshopId: string
    workshopKind: "customer" | "internal"
  }>
  leads: Array<{
    id: string
    status: string
    advisorId: string | null
    workshopId: string | null
    workshop: {
      acquisitionSource: string
      acquisitionAdvisorId: string | null
    } | null
    usedRegistrationLinks: Array<{
      id: string
      advisorId: string
      workshopId: string | null
    }>
  }>
  billingOrders: Array<{
    id: string
    amountMinor: number
    vatRateBps: number
    grossAmountMinor: number
    netAmountMinor: number
  }>
  commissions: Array<{
    id: string
    reviewReason: "missing_rule" | "legacy_manual" | null
    ruleId: string | null
    calculationBaseMinor: number | null
    calculationRateBps: number | null
    calculatedAmountMinor: number | null
  }>
}

export type SalesRolloutAuditReport = {
  generatedAt: string
  scanned: {
    advisors: number
    leads: number
    billingOrders: number
    commissions: number
  }
  totals: Record<SalesRolloutAuditSeverity, number>
  categories: Record<SalesRolloutAuditCategory, number>
  findings: SalesRolloutAuditFinding[]
}

function expectedNetAmountMinor(grossAmountMinor: number, vatRateBps: number): number | null {
  if (
    !Number.isSafeInteger(grossAmountMinor) ||
    !Number.isSafeInteger(vatRateBps) ||
    grossAmountMinor < 0 ||
    vatRateBps < 0 ||
    vatRateBps > 10_000
  ) {
    return null
  }
  const denominator = BigInt(10_000 + vatRateBps)
  const rounded = (BigInt(grossAmountMinor) * BigInt(10_000) + denominator / BigInt(2)) / denominator
  const amount = Number(rounded)
  return Number.isSafeInteger(amount) ? amount : null
}

function createCategoryTotals(): Record<SalesRolloutAuditCategory, number> {
  return Object.fromEntries(
    SALES_ROLLOUT_AUDIT_CATEGORIES.map((category) => [category, 0]),
  ) as Record<SalesRolloutAuditCategory, number>
}

/**
 * Eski satış verisini yalnız sınıflandırır. Bu fonksiyon ve onu besleyen CLI
 * düzeltme/backfill yapmaz; rollout kararını kayıt kimlikleriyle insana bırakır.
 */
export function buildSalesRolloutAuditReport(
  snapshot: SalesRolloutAuditSnapshot,
  generatedAt = new Date(),
): SalesRolloutAuditReport {
  const findings: SalesRolloutAuditFinding[] = []
  const add = (finding: SalesRolloutAuditFinding) => findings.push(finding)

  for (const advisor of snapshot.advisors) {
    if (advisor.workshopKind === "customer") {
      add({
        category: "advisor_customer_tenant_conflict",
        severity: "error",
        entity: "SalesAdvisor",
        id: advisor.id,
        relatedIds: [advisor.userId, advisor.workshopId],
        detail: `Danışman kullanıcısı customer iş yerine ${advisor.userRole} rolüyle bağlı; otomatik taşınmamalı, ayrı satış e-postasıyla yeniden davet edilmeli.`,
      })
    }
  }

  for (const lead of snapshot.leads) {
    if (lead.status === "won" && !lead.workshopId) {
      add({
        category: "won_lead_without_workshop",
        severity: "error",
        entity: "SalesLead",
        id: lead.id,
        relatedIds: lead.advisorId ? [lead.advisorId] : [],
        detail: "Kazanılmış lead bir müşteri iş yerine bağlı değil.",
      })
    }

    if (lead.workshopId && !lead.advisorId) {
      add({
        category: "converted_lead_missing_advisor",
        severity: "error",
        entity: "SalesLead",
        id: lead.id,
        relatedIds: [lead.workshopId],
        detail: "İş yerine dönüşmüş lead üzerinde danışman atfı yok.",
      })
    }

    if (lead.workshop?.acquisitionSource === "sales_advisor" && !lead.workshop.acquisitionAdvisorId) {
      add({
        category: "sales_workshop_missing_advisor",
        severity: "error",
        entity: "SalesLead",
        id: lead.id,
        relatedIds: lead.workshopId ? [lead.workshopId] : [],
        detail: "Satış danışmanı kaynaklı iş yerinde acquisitionAdvisorId yok.",
      })
    }

    if (lead.workshopId && lead.advisorId && lead.workshop?.acquisitionSource !== "sales_advisor") {
      add({
        category: "lead_workshop_source_mismatch",
        severity: "warning",
        entity: "SalesLead",
        id: lead.id,
        relatedIds: [lead.advisorId, lead.workshopId],
        detail: "Danışman atıflı dönüşümün iş yeri edinim kaynağı sales_advisor değil.",
      })
    }

    if (
      lead.advisorId &&
      lead.workshop?.acquisitionAdvisorId &&
      lead.advisorId !== lead.workshop.acquisitionAdvisorId
    ) {
      add({
        category: "lead_workshop_attribution_mismatch",
        severity: "error",
        entity: "SalesLead",
        id: lead.id,
        relatedIds: [lead.advisorId, lead.workshop.acquisitionAdvisorId, ...(lead.workshopId ? [lead.workshopId] : [])],
        detail: "Lead danışmanı ile iş yerinin edinim danışmanı farklı.",
      })
    }

    for (const link of lead.usedRegistrationLinks) {
      if (link.advisorId === lead.advisorId && link.workshopId === lead.workshopId) continue
      add({
        category: "registration_link_attribution_mismatch",
        severity: "error",
        entity: "SalesLead",
        id: lead.id,
        relatedIds: [link.id, link.advisorId, ...(link.workshopId ? [link.workshopId] : [])],
        detail: "Kullanılmış kayıt bağlantısının danışman veya iş yeri atfı lead ile eşleşmiyor.",
      })
    }
  }

  for (const order of snapshot.billingOrders) {
    const expectedNet = expectedNetAmountMinor(order.grossAmountMinor, order.vatRateBps)
    if (
      order.vatRateBps !== 2_000 ||
      order.amountMinor !== order.grossAmountMinor ||
      expectedNet == null ||
      order.netAmountMinor !== expectedNet
    ) {
      add({
        category: "billing_tax_snapshot_invalid",
        severity: "error",
        entity: "BillingOrder",
        id: order.id,
        relatedIds: [],
        detail: `KDV snapshot'ı tutarsız: vatRateBps=${order.vatRateBps}, amount=${order.amountMinor}, gross=${order.grossAmountMinor}, net=${order.netAmountMinor}, expectedNet=${expectedNet ?? "invalid"}.`,
      })
    }
  }

  for (const commission of snapshot.commissions) {
    if (commission.reviewReason === "legacy_manual") {
      add({
        category: "legacy_manual_commission",
        severity: "info",
        entity: "SalesCommission",
        id: commission.id,
        relatedIds: commission.ruleId ? [commission.ruleId] : [],
        detail: "Eski manuel hakediş tutarı migration tarafından değiştirilmeden korunmuş; insan incelemesi gerekir.",
      })
      continue
    }

    const missingRuleShape =
      commission.reviewReason === "missing_rule" &&
      commission.ruleId == null &&
      commission.calculationBaseMinor != null &&
      commission.calculationRateBps == null &&
      commission.calculatedAmountMinor == null
    const calculatedShape =
      commission.reviewReason == null &&
      commission.ruleId != null &&
      commission.calculationBaseMinor != null &&
      commission.calculationRateBps != null &&
      commission.calculatedAmountMinor != null

    if (!missingRuleShape && !calculatedShape) {
      add({
        category: "commission_snapshot_incomplete",
        severity: "error",
        entity: "SalesCommission",
        id: commission.id,
        relatedIds: commission.ruleId ? [commission.ruleId] : [],
        detail: "Hakedişin kural-eksik veya hesaplanmış snapshot alanları beklenen bütünlükte değil.",
      })
    }
  }

  findings.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id))
  const categories = createCategoryTotals()
  const totals: Record<SalesRolloutAuditSeverity, number> = { error: 0, warning: 0, info: 0 }
  for (const finding of findings) {
    categories[finding.category] += 1
    totals[finding.severity] += 1
  }

  return {
    generatedAt: generatedAt.toISOString(),
    scanned: {
      advisors: snapshot.advisors.length,
      leads: snapshot.leads.length,
      billingOrders: snapshot.billingOrders.length,
      commissions: snapshot.commissions.length,
    },
    totals,
    categories,
    findings,
  }
}

import { describe, expect, test } from "bun:test"
import {
  buildSalesRolloutAuditReport,
  type SalesRolloutAuditSnapshot,
} from "./rollout-audit"

function emptySnapshot(): SalesRolloutAuditSnapshot {
  return { advisors: [], leads: [], billingOrders: [], commissions: [] }
}

describe("sales rollout audit", () => {
  test("temiz snapshot bulgusuz ve sayımlarıyla raporlanır", () => {
    const report = buildSalesRolloutAuditReport(emptySnapshot(), new Date("2026-08-29T00:00:00.000Z"))

    expect(report.generatedAt).toBe("2026-08-29T00:00:00.000Z")
    expect(report.totals).toEqual({ error: 0, warning: 0, info: 0 })
    expect(report.findings).toEqual([])
  })

  test("customer tenant danışmanını ve atıf uyuşmazlıklarını kimlikleriyle ayırır", () => {
    const snapshot = emptySnapshot()
    snapshot.advisors.push({
      id: "advisor-conflict",
      userId: "user-1",
      userRole: "owner",
      workshopId: "tenant-1",
      workshopKind: "customer",
    })
    snapshot.leads.push({
      id: "lead-1",
      status: "won",
      advisorId: "advisor-conflict",
      workshopId: "workshop-1",
      workshop: { acquisitionSource: "website", acquisitionAdvisorId: "advisor-other" },
      usedRegistrationLinks: [{ id: "link-1", advisorId: "advisor-other", workshopId: "workshop-2" }],
    })

    const report = buildSalesRolloutAuditReport(snapshot)

    expect(report.findings.map((finding) => finding.category)).toEqual([
      "advisor_customer_tenant_conflict",
      "lead_workshop_attribution_mismatch",
      "lead_workshop_source_mismatch",
      "registration_link_attribution_mismatch",
    ])
    expect(report.findings.every((finding) => finding.id.length > 0)).toBe(true)
    expect(report.totals).toEqual({ error: 3, warning: 1, info: 0 })
  })

  test("KDV net snapshot'ını PostgreSQL ROUND ile aynı kuruş hassasiyetinde doğrular", () => {
    const snapshot = emptySnapshot()
    snapshot.billingOrders.push(
      { id: "valid", amountMinor: 12_001, vatRateBps: 2_000, grossAmountMinor: 12_001, netAmountMinor: 10_001 },
      { id: "invalid", amountMinor: 12_001, vatRateBps: 2_000, grossAmountMinor: 12_001, netAmountMinor: 10_000 },
    )

    const report = buildSalesRolloutAuditReport(snapshot)

    expect(report.findings).toHaveLength(1)
    expect(report.findings[0]).toMatchObject({ category: "billing_tax_snapshot_invalid", id: "invalid" })
  })

  test("legacy manuel kayıtları değiştirmeden bilgi bulgusu; bozuk yeni snapshot'ı hata olarak verir", () => {
    const snapshot = emptySnapshot()
    snapshot.commissions.push(
      {
        id: "legacy",
        reviewReason: "legacy_manual",
        ruleId: null,
        calculationBaseMinor: null,
        calculationRateBps: null,
        calculatedAmountMinor: null,
      },
      {
        id: "missing-rule-valid",
        reviewReason: "missing_rule",
        ruleId: null,
        calculationBaseMinor: 10_000,
        calculationRateBps: null,
        calculatedAmountMinor: null,
      },
      {
        id: "calculated-invalid",
        reviewReason: null,
        ruleId: "rule-1",
        calculationBaseMinor: 10_000,
        calculationRateBps: null,
        calculatedAmountMinor: 1_000,
      },
    )

    const report = buildSalesRolloutAuditReport(snapshot)

    expect(report.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "legacy_manual_commission", severity: "info", id: "legacy" }),
      expect.objectContaining({ category: "commission_snapshot_incomplete", severity: "error", id: "calculated-invalid" }),
    ]))
    expect(report.findings.some((finding) => finding.id === "missing-rule-valid")).toBe(false)
  })
})

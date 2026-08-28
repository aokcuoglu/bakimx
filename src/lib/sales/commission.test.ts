import { describe, expect, it } from "bun:test"
import type { Prisma } from "@prisma/client"
import {
  calculateCommissionAmountMinor,
  canTransitionSalesCommission,
  commissionApprovalError,
  createCommissionDraftForBillingOrderTx,
  isCommissionEligible,
  type CommissionOrderSnapshot,
} from "./commission"

const baseOrder: CommissionOrderSnapshot = {
  id: "order-1",
  workshopId: "workshop-1",
  type: "new_purchase",
  planTier: "pro",
  previousPlanTier: null,
  billingCycle: "monthly",
  createdAt: new Date("2026-08-01T09:00:00.000Z"),
  netAmountMinor: 108_250,
}

describe("commission eligibility and money math", () => {
  it("yalnız ilk satış ve gerçek yükseltmeyi uygun sayar", () => {
    expect(isCommissionEligible({ type: "new_purchase", previousPlanTier: null, targetPlanTier: "starter" })).toBe(true)
    expect(isCommissionEligible({ type: "upgrade", previousPlanTier: "starter", targetPlanTier: "pro" })).toBe(true)
    expect(isCommissionEligible({ type: "upgrade", previousPlanTier: "pro", targetPlanTier: "pro" })).toBe(false)
    expect(isCommissionEligible({ type: "renewal", previousPlanTier: "pro", targetPlanTier: "pro" })).toBe(false)
    expect(isCommissionEligible({ type: "downgrade", previousPlanTier: "premium", targetPlanTier: "pro" })).toBe(false)
  })

  it("net kuruş ile baz puanı tam kuruşa yuvarlar", () => {
    expect(calculateCommissionAmountMinor(108_250, 1_250)).toBe(13_531)
    expect(calculateCommissionAmountMinor(10_000, 0)).toBe(0)
    expect(calculateCommissionAmountMinor(Number.MAX_SAFE_INTEGER, 3_333)).toBe(3_002_099_511_605_172)
    expect(() => calculateCommissionAmountMinor(10_000, 10_001)).toThrow()
  })
})

describe("commission ledger state machine", () => {
  it("yalnız draft → approved → paid veya void geçişlerini kabul eder", () => {
    expect(canTransitionSalesCommission("draft", "approved")).toBe(true)
    expect(canTransitionSalesCommission("draft", "void")).toBe(true)
    expect(canTransitionSalesCommission("approved", "paid")).toBe(true)
    expect(canTransitionSalesCommission("approved", "void")).toBe(true)
    expect(canTransitionSalesCommission("draft", "paid")).toBe(false)
    expect(canTransitionSalesCommission("paid", "void")).toBe(false)
    expect(canTransitionSalesCommission("void", "approved")).toBe(false)
  })

  it("hesaplanan tutardan sapmayı ve kural-eksik manuel onayı gerekçesiz reddeder", () => {
    expect(commissionApprovalError({ calculatedAmountMinor: 1_000, approvedAmountMinor: 1_000, adjustmentReason: "" })).toBeNull()
    expect(commissionApprovalError({ calculatedAmountMinor: 1_000, approvedAmountMinor: 1_200, adjustmentReason: "" })).not.toBeNull()
    expect(commissionApprovalError({ calculatedAmountMinor: null, approvedAmountMinor: 1_200, adjustmentReason: "" })).not.toBeNull()
    expect(commissionApprovalError({ calculatedAmountMinor: 1_000, approvedAmountMinor: 1_200, adjustmentReason: "Prim düzeltmesi" })).toBeNull()
  })
})

describe("commission draft persistence", () => {
  it("sipariş tarihindeki kuralı snapshot eder ve tekrar çağrıda ikinci kayıt açmaz", async () => {
    let existingId: string | null = null
    const creates: Array<Record<string, unknown>> = []
    const tx = {
      salesCommission: {
        findUnique: async () => existingId ? { id: existingId } : null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          creates.push(data)
          existingId = "commission-1"
          return { id: existingId }
        },
      },
      salesLead: {
        findUnique: async () => ({ id: "lead-1", advisorId: "advisor-1" }),
      },
      salesCommissionRule: {
        findFirst: async () => ({ id: "rule-1", rateBps: 1_250 }),
      },
    } as unknown as Prisma.TransactionClient

    const first = await createCommissionDraftForBillingOrderTx(tx, baseOrder, null, { label: "tami" })
    const replay = await createCommissionDraftForBillingOrderTx(tx, baseOrder, null, { label: "tami" })

    expect(first).toEqual({ created: true, commissionId: "commission-1", reviewReason: null })
    expect(replay).toEqual({ created: false, reason: "already_exists" })
    expect(creates).toHaveLength(1)
    expect(creates[0]).toMatchObject({
      ruleId: "rule-1",
      calculationBaseMinor: 108_250,
      calculationRateBps: 1_250,
      calculatedAmountMinor: 13_531,
      reviewReason: null,
    })
  })

  it("kural yoksa ödemeyi engelleyecek hata yerine inceleme taslağı üretir", async () => {
    const tx = {
      salesCommission: {
        findUnique: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          expect(data).toMatchObject({
            calculationBaseMinor: 108_250,
            calculationRateBps: null,
            calculatedAmountMinor: null,
            reviewReason: "missing_rule",
          })
          return { id: "commission-missing-rule" }
        },
      },
      salesLead: { findUnique: async () => ({ id: "lead-1", advisorId: "advisor-1" }) },
      salesCommissionRule: { findFirst: async () => null },
    } as unknown as Prisma.TransactionClient

    await expect(
      createCommissionDraftForBillingOrderTx(tx, baseOrder, null, { label: "tami" }),
    ).resolves.toEqual({
      created: true,
      commissionId: "commission-missing-rule",
      reviewReason: "missing_rule",
    })
  })
})

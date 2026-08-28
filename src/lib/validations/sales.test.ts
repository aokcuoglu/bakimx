import { describe, expect, it } from "bun:test"
import {
  salesActivitySchema,
  salesDiscountCodeSchema,
  salesDiscountCodeUpdateSchema,
  salesCommissionApprovalSchema,
  salesCommissionRuleSchema,
  salesCommissionVoidSchema,
  salesLeadSchema,
  salesTaskSchema,
} from "./sales"

describe("sales commission validation", () => {
  it("kuruş tutarını, append-only kural girdisini ve iptal gerekçesini doğrular", () => {
    expect(salesCommissionApprovalSchema.safeParse({
      approvedAmountMinor: 12_345,
      adjustmentReason: "",
      note: "",
    }).success).toBe(true)
    expect(salesCommissionRuleSchema.safeParse({
      planTier: "pro",
      billingCycle: "yearly",
      ratePercent: 12.5,
      effectiveFrom: "2026-09-01T03:00",
    }).success).toBe(true)
    expect(salesCommissionRuleSchema.safeParse({
      planTier: "pro",
      billingCycle: "yearly",
      ratePercent: 12.345,
      effectiveFrom: "2026-09-01T03:00",
    }).success).toBe(false)
    expect(salesCommissionVoidSchema.safeParse({ reason: "" }).success).toBe(false)
  })
})

describe("sales discount code update validation", () => {
  it("accepts a date input value", () => {
    expect(salesDiscountCodeUpdateSchema.safeParse({ expiresAt: "2026-09-02" }).success).toBe(true)
  })

  it("rejects malformed dates", () => {
    expect(salesDiscountCodeUpdateSchema.safeParse({ expiresAt: "02/09/2026" }).success).toBe(false)
  })
})

describe("sales discount code creation validation", () => {
  it("accepts the two explicit funding sources", () => {
    expect(salesDiscountCodeSchema.safeParse({
      discountPercent: 12,
      advisorId: "advisor-1",
      fundingSource: "bakimx_funded",
    }).success).toBe(true)
    expect(salesDiscountCodeSchema.safeParse({
      discountPercent: 8,
      fundingSource: "advisor_margin",
    }).success).toBe(true)
  })

  it("rejects an unknown funding source", () => {
    expect(salesDiscountCodeSchema.safeParse({
      discountPercent: 10,
      fundingSource: "campaign",
    }).success).toBe(false)
  })
})

describe("sales CRM validation", () => {
  const validLead = {
    businessName: "Örnek Servis",
    contactName: "Ayşe Yılmaz",
    phone: "0532 000 00 00",
    email: "",
    city: "İstanbul",
    district: "Kadıköy",
    address: "Rıhtım Cad.",
    monthlyVehicles: "51-100",
    notes: "",
  }

  it("accepts the complete lead form", () => {
    expect(salesLeadSchema.safeParse(validLead).success).toBe(true)
  })

  it("requires a result for interactions but not plain notes", () => {
    expect(salesActivitySchema.safeParse({ type: "phone", summary: "Arandı" }).success).toBe(false)
    expect(salesActivitySchema.safeParse({ type: "note", summary: "İç not" }).success).toBe(true)
  })

  it("requires a next action date for follow-up and demo outcomes", () => {
    expect(salesActivitySchema.safeParse({
      type: "phone",
      result: "follow_up_required",
      summary: "Haftaya tekrar ara",
    }).success).toBe(false)
    expect(salesActivitySchema.safeParse({
      type: "demo",
      result: "demo_scheduled",
      summary: "Demo planlandı",
      nextActionAt: "2026-09-02T10:00:00.000Z",
    }).success).toBe(true)
  })

  it("requires a loss reason", () => {
    expect(salesActivitySchema.safeParse({
      type: "phone",
      result: "lost",
      summary: "Olumsuz sonuçlandı",
    }).success).toBe(false)
  })

  it("keeps plain notes result-free and terminal outcomes task-free", () => {
    expect(salesActivitySchema.safeParse({
      type: "note",
      result: "won",
      summary: "Serbest not",
    }).success).toBe(false)
    expect(salesActivitySchema.safeParse({
      type: "phone",
      result: "won",
      summary: "Satış tamamlandı",
      nextActionAt: "2026-08-28T10:00",
    }).success).toBe(false)
  })

  it("bounds task duration", () => {
    expect(salesTaskSchema.safeParse({ type: "call", startsAt: "2026-09-02T10:00:00.000Z", durationMinutes: 30, note: "" }).success).toBe(true)
    expect(salesTaskSchema.safeParse({ type: "call", startsAt: "2026-09-02T10:00:00.000Z", durationMinutes: 2, note: "" }).success).toBe(false)
  })
})

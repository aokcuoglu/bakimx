import { describe, expect, it } from "bun:test"
import { canManageSalesDiscountCode, resolveSalesDiscountAssignment } from "./discount-policy"

const advisor = { kind: "advisor" as const, userId: "user-a", advisorId: "advisor-a" }
const admin = { kind: "admin" as const, userId: "founder", advisorId: null }

describe("sales discount funding policy", () => {
  it("charges advisor-created codes to that advisor's margin", () => {
    expect(resolveSalesDiscountAssignment(advisor, {}, null)).toEqual({
      ok: true,
      assignment: {
        fundingSource: "advisor_margin",
        advisorId: "advisor-a",
        leadId: null,
        createdByUserId: "user-a",
      },
    })
  })

  it("does not let an advisor claim BakımX funding", () => {
    const result = resolveSalesDiscountAssignment(advisor, { fundingSource: "bakimx_funded" }, null)
    expect(result.ok).toBe(false)
  })

  it("requires platform codes to be assigned to an advisor", () => {
    const result = resolveSalesDiscountAssignment(admin, { fundingSource: "bakimx_funded" }, null)
    expect(result).toEqual({ ok: false, error: "BakımX destekli kod için bir satış danışmanı seçin." })
  })

  it("keeps the lead and advisor assignment consistent", () => {
    const result = resolveSalesDiscountAssignment(
      admin,
      { fundingSource: "bakimx_funded", advisorId: "advisor-b", leadId: "lead-a" },
      { id: "lead-a", advisorId: "advisor-a", status: "proposal" },
    )
    expect(result.ok).toBe(false)
  })

  it("prevents creating fresh codes for closed leads", () => {
    const result = resolveSalesDiscountAssignment(
      advisor,
      { leadId: "lead-a" },
      { id: "lead-a", advisorId: "advisor-a", status: "won" },
    )
    expect(result.ok).toBe(false)
  })

  it("lets advisors share but not manage BakımX-funded codes", () => {
    expect(canManageSalesDiscountCode(advisor, {
      fundingSource: "bakimx_funded",
      advisorId: "advisor-a",
    })).toBe(false)
    expect(canManageSalesDiscountCode(advisor, {
      fundingSource: "advisor_margin",
      advisorId: "advisor-a",
    })).toBe(true)
  })
})

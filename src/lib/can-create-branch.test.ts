import { describe, expect, test } from "bun:test"
import { canCreateBranch } from "@/lib/can-create-branch"

const base = {
  planTier: "premium" as const,
  subscriptionStatus: "active" as const,
  approvalStatus: "approved" as const,
  trialEndsAt: null,
  currentPeriodEnd: null,
  addons: [] as string[],
}

describe("canCreateBranch", () => {
  test("allows premium owners", () => {
    expect(canCreateBranch({ ...base, role: "owner" })).toBe(true)
  })

  test("blocks non-owners even on premium", () => {
    expect(canCreateBranch({ ...base, role: "manager" })).toBe(false)
    expect(canCreateBranch({ ...base, role: "usta" })).toBe(false)
  })

  test("blocks lite owners", () => {
    expect(
      canCreateBranch({
        ...base,
        planTier: "lite",
        role: "owner",
      }),
    ).toBe(false)
  })

  test("allows Servis Paketi owners whose workshop has multiBranch add-on (#827)", () => {
    expect(canCreateBranch({ ...base, planTier: "pro", addons: ["multiBranch"], role: "owner" })).toBe(true)
    expect(canCreateBranch({ ...base, planTier: "pro", addons: ["ocrIntake"], role: "owner" })).toBe(false)
    expect(canCreateBranch({ ...base, planTier: "pro", addons: ["multiBranch"], role: "manager" })).toBe(false)
  })

  test("blocks paid Servis Paketi owners — çoklu şube ek özellik (#782)", () => {
    expect(
      canCreateBranch({
        ...base,
        planTier: "pro",
        role: "owner",
      }),
    ).toBe(false)
  })

  test("allows trialing owners (trial includes add-ons)", () => {
    expect(
      canCreateBranch({
        ...base,
        planTier: "pro",
        subscriptionStatus: "trialing",
        trialEndsAt: new Date(Date.now() + 7 * 86_400_000),
        role: "owner",
      }),
    ).toBe(true)
  })
})

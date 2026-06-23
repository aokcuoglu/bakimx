import { expect, test } from "bun:test"
import { hasFeature } from "@/lib/plan"

// AI Servis Danışmanı is a Premium-only capability. Trial workshops run on the
// `pro` tier, so the advisor stays locked until they upgrade.
test("aiAdvisor is gated to the premium tier", () => {
  expect(hasFeature("premium", "aiAdvisor")).toBe(true)
  expect(hasFeature("pro", "aiAdvisor")).toBe(false)
  expect(hasFeature("starter", "aiAdvisor")).toBe(false)
})

test("all premium-gated features are locked below the premium tier", () => {
  const premiumOnly = ["eInvoice", "aiAdvisor", "multiBranch", "rbac"] as const
  for (const feature of premiumOnly) {
    expect(hasFeature("starter", feature)).toBe(false)
    expect(hasFeature("pro", feature)).toBe(false)
    expect(hasFeature("premium", feature)).toBe(true)
  }
})

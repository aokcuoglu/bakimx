import { expect, test } from "bun:test"
import { computeAddonMrrMinor, splitMonthRevenue } from "@/lib/billing/revenue-split"

const line = { key: "vinLookup", name: "VIN", quantity: 1, unitAmountMinor: 39_900, amountMinor: 39_900 }

test("bu ay tahsilatı paket ve ek özelliğe ayrılır", () => {
  expect(
    splitMonthRevenue([
      { type: "renewal", amountMinor: 139_900, addonLines: [line] },
      { type: "new_purchase", amountMinor: 100_000 },
      { type: "addon", amountMinor: 24_900 },
    ]),
  ).toEqual({ packageMinor: 200_000, addonMinor: 64_800, totalMinor: 264_800 })
  expect(splitMonthRevenue([])).toEqual({ packageMinor: 0, addonMinor: 0, totalMinor: 0 })
})

test("ek özellik MRR: aylık olduğu gibi, yıllık 12'ye bölünür; multiBranch sayılmaz", () => {
  expect(
    computeAddonMrrMinor([
      { paidAddons: ["vinLookup", "ocrIntake"], billingCycle: "monthly" },
      { paidAddons: ["vinLookup", "multiBranch"], billingCycle: "yearly" },
      { paidAddons: [], billingCycle: "monthly" },
      { paidAddons: ["vinLookup"], billingCycle: null },
    ]),
  ).toBe(39_900 + 24_900 + Math.round(399_000 / 12) + 39_900)
})

import { expect, test } from "bun:test"
import { planPaidAddonsAfterAdminChange, type PaidAddonsClient } from "@/lib/admin/paid-addons-sync"
import { addonFeaturesFor } from "@/lib/billing/addon-pricing"

type Row = { id: string; organizationId: string | null; createdAt: Date; paidAddons: string[] }

function client(rows: Row[]): PaidAddonsClient {
  return {
    workshop: {
      findUnique: async ({ where }) => rows.find((r) => r.id === where.id) ?? null,
      findMany: async ({ where }) => rows.filter((r) => r.organizationId === where.organizationId),
    },
  }
}

const all = addonFeaturesFor(["vinLookup", "ocrIntake"])
const withoutOcr = all.filter((f) => !addonFeaturesFor(["ocrIntake"]).includes(f) || addonFeaturesFor(["vinLookup"]).includes(f))

test("şubeden kaydedilse bile hesap atölyesinin paidAddons'u güncellenir", async () => {
  const rows: Row[] = [
    { id: "a", organizationId: "o", createdAt: new Date(1), paidAddons: ["vinLookup", "ocrIntake"] },
    { id: "b", organizationId: "o", createdAt: new Date(2), paidAddons: [] },
  ]
  expect(await planPaidAddonsAfterAdminChange(client(rows), "b", withoutOcr)).toEqual({
    accountId: "a",
    paidAddons: ["vinLookup"],
    removed: ["ocrIntake"],
  })
})

test("değişiklik yoksa null", async () => {
  const rows: Row[] = [{ id: "a", organizationId: null, createdAt: new Date(1), paidAddons: ["vinLookup"] }]
  expect(await planPaidAddonsAfterAdminChange(client(rows), "a", all)).toBeNull()
})

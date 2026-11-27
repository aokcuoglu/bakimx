import { expect, test } from "bun:test"
import { planAddonFanOut, resolveAddonTargets, type AddonTargetClient } from "@/lib/admin/addon-targets"

type Row = { id: string; addons: string[]; organizationId: string | null; kind: string }

function fakeDb(rows: Row[]): AddonTargetClient {
  return {
    workshop: {
      findFirst: async ({ where }) => {
        const r = rows.find((x) => x.id === where.id && x.kind === where.kind)
        return r ? { id: r.id, addons: r.addons, organizationId: r.organizationId } : null
      },
      findMany: async ({ where }) =>
        rows
          .filter((x) => x.organizationId === where.organizationId && x.kind === where.kind)
          .map((x) => ({ id: x.id, addons: x.addons })),
    },
  }
}

const rows: Row[] = [
  { id: "a", addons: ["vinLookup"], organizationId: "org1", kind: "customer" },
  { id: "b", addons: [], organizationId: "org1", kind: "customer" },
  { id: "hq", addons: [], organizationId: "org1", kind: "partner" },
  { id: "solo", addons: [], organizationId: null, kind: "customer" },
  { id: "other", addons: [], organizationId: "org2", kind: "customer" },
]

test("yalnız organizasyonun müşteri şubeleri hedeflenir, seçilen ilk sırada", async () => {
  const targets = await resolveAddonTargets(fakeDb(rows), "b")
  expect(targets?.map((t) => t.id)).toEqual(["b", "a"])
})

test("organizasyonsuz atölye tek başınadır", async () => {
  expect(await resolveAddonTargets(fakeDb(rows), "solo")).toEqual([{ id: "solo", addons: [] }])
})

test("müşteri olmayan ya da yok atölye null döner", async () => {
  expect(await resolveAddonTargets(fakeDb(rows), "hq")).toBeNull()
  expect(await resolveAddonTargets(fakeDb(rows), "nope")).toBeNull()
})

test("kaldırma tüm şubelere yayılır; her şube için kendi farkı", () => {
  const plan = planAddonFanOut(
    [{ id: "a", addons: ["vinLookup"] }, { id: "b", addons: ["vinLookup"] }],
    [],
  )
  expect(plan.noop).toBe(false)
  expect(plan.workshopIds).toEqual(["a", "b"])
  expect(plan.entries.map((e) => e.diff.removed)).toEqual([["vinLookup"], ["vinLookup"]])
})

test("tek atölyede davranış değişmez", () => {
  expect(planAddonFanOut([{ id: "solo", addons: [] }], ["vinLookup"]).entries).toHaveLength(1)
  expect(planAddonFanOut([{ id: "solo", addons: ["vinLookup"] }], ["vinLookup"]).noop).toBe(true)
})

test("no-op yalnız tüm hedefler eşitken; ayrışmış kardeş varsa yazılır", () => {
  const diverged = planAddonFanOut([{ id: "a", addons: ["vinLookup"] }, { id: "b", addons: [] }], ["vinLookup"])
  expect(diverged.noop).toBe(false)
  expect(diverged.entries[0].diff.added).toEqual([])
  expect(diverged.entries[1].diff.added).toEqual(["vinLookup"])
  expect(planAddonFanOut([{ id: "a", addons: ["vinLookup"] }, { id: "b", addons: ["vinLookup"] }], ["vinLookup"]).noop).toBe(true)
})

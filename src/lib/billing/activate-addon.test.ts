import { beforeEach, describe, expect, mock, test } from "bun:test"
import type { BillingOrder } from "@prisma/client"

/**
 * #829 — ek özellik aktivasyonu. DB'siz: prisma `mock.module` ile bellek-içi
 * taklit edilir (`@/lib/db` ve `@/lib/audit`ın kendi test dosyası yok).
 * `resolveBillingAccount` GERÇEK koşar; taklit tx ona `workshop.findMany` verir.
 */

type W = {
  id: string
  organizationId: string | null
  kind: "customer"
  createdAt: Date
  planTier: string
  extraSeats: number
  currentPeriodEnd: Date | null
  addons: string[]
  paidAddons: string[]
}

let workshops: W[] = []
let orderStatus = "pending_payment"
let claimWrites: Record<string, unknown>[] = []
let audits: string[] = []
let lockedIds: string[] = []
let branchLockIds: string[] = []

const tx = {
  $queryRaw: async (_s: TemplateStringsArray, arg: unknown) => {
    if (typeof arg === "string") lockedIds.push(arg)
    else branchLockIds.push(...((arg as { values: string[] }).values))
    return []
  },
  workshop: {
    findUnique: async ({ where }: { where: { id: string } }) => workshops.find((w) => w.id === where.id) ?? null,
    findMany: async ({ where }: { where: { organizationId?: string; id?: { in: string[] } } }) =>
      workshops.filter((w) => (where.id ? where.id.in.includes(w.id) : w.organizationId === where.organizationId)),
    update: async ({ where, data }: { where: { id: string }; data: Partial<W> }) => {
      Object.assign(workshops.find((w) => w.id === where.id) as W, data)
    },
  },
  billingOrder: {
    updateMany: async ({ where, data }: { where: { status: string }; data: Record<string, unknown> }) => {
      if (orderStatus !== where.status) return { count: 0 }
      orderStatus = data.status as string
      claimWrites.push(data)
      return { count: 1 }
    },
  },
}

mock.module("@/lib/db", () => ({
  prisma: { $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) },
}))
mock.module("@/lib/audit", () => ({
  AuditLogAction: async (_w: string, _u: unknown, _e: string, _id: string, action: string) => {
    audits.push(action)
  },
}))

const { activateAddonOrder, applyAddonEntitlementsTx } = await import("./activate-addon")

const FUTURE = new Date(Date.now() + 10 * 86_400_000)
const lines = [{ key: "vinLookup", name: "Şaseden parça", quantity: 1, unitAmountMinor: 1000, amountMinor: 1000 }]

function order(over: Partial<BillingOrder> = {}): BillingOrder {
  return {
    id: "o1",
    workshopId: "w1",
    type: "addon",
    planTier: "pro",
    billingCycle: "monthly",
    amountMinor: 1000,
    addonLines: lines,
    status: "pending_payment",
    ...over,
  } as unknown as BillingOrder
}
const opts = { actor: "payment", confirmedByEmail: "tami" } as const

function ws(id: string, createdAt: number, over: Partial<W> = {}): W {
  return {
    id,
    organizationId: "org",
    kind: "customer",
    createdAt: new Date(createdAt),
    planTier: "pro",
    extraSeats: 0,
    currentPeriodEnd: FUTURE,
    addons: [],
    paidAddons: [],
    ...over,
  }
}

beforeEach(() => {
  workshops = [ws("w1", 1), ws("w2", 2), ws("w3", 3)]
  orderStatus = "pending_payment"
  claimWrites = []
  audits = []
  lockedIds = []
  branchLockIds = []
})

describe("activateAddonOrder", () => {
  test("hesabın TÜM atölyelerine addons yazar, paidAddons yalnız hesap atölyesinde", async () => {
    const res = await activateAddonOrder(order(), opts)
    expect(res.ok).toBe(true)
    for (const w of workshops) expect(w.addons).toEqual(["vinLookup", "partsCatalog"])
    expect(workshops[0].paidAddons).toEqual(["vinLookup"])
    expect(workshops[1].paidAddons).toEqual([])
    expect(audits).toEqual(["billing_addon_order_confirmed"])
  })

  test("mevcut addons ve paidAddons ile birleşir, tekrar etmez", async () => {
    workshops[0].addons = ["ocrIntake"]
    workshops[0].paidAddons = ["ocrIntake"]
    workshops[1].addons = ["vinLookup"]
    await activateAddonOrder(order(), opts)
    expect(workshops[0].addons).toEqual(["vinLookup", "partsCatalog", "ocrIntake"])
    expect(workshops[1].addons).toEqual(["vinLookup", "partsCatalog"])
    expect(workshops[0].paidAddons).toEqual(["ocrIntake", "vinLookup"])
  })

  test("paket, dönem sonu ve koltuklara dokunmaz; siparişe dönem sonunu yazar", async () => {
    await activateAddonOrder(order(), opts)
    expect(workshops[0].planTier).toBe("pro")
    expect(workshops[0].currentPeriodEnd).toBe(FUTURE)
    expect(workshops[0].extraSeats).toBe(0)
    expect(claimWrites[0]).toMatchObject({ status: "confirmed", periodEnd: FUTURE, confirmedByEmail: "tami" })
    expect(lockedIds).toEqual(["w1"])
    expect(branchLockIds).toEqual([...branchLockIds].sort())
    expect(branchLockIds).toContain("w1")
  })

  test("ikinci çağrı talebi kaybeder (idempotent) ve tekrar yazmaz", async () => {
    expect((await activateAddonOrder(order(), opts)).ok).toBe(true)
    workshops[1].addons = []
    const second = await activateAddonOrder(order(), opts)
    expect(second).toEqual({ ok: false, error: "Bu sipariş zaten işlenmiş." })
    expect(workshops[1].addons).toEqual([])
    expect(audits).toHaveLength(1)
  })

  test("dönem bitmişse etkinleştirmez ve sipariş beklemede kalır", async () => {
    workshops[0].currentPeriodEnd = new Date(Date.now() - 1000)
    const res = await activateAddonOrder(order(), opts)
    expect(res.ok).toBe(false)
    expect(orderStatus).toBe("pending_payment")
    expect(workshops[1].addons).toEqual([])
  })

  test("okunamayan kalemde reddeder", async () => {
    const res = await activateAddonOrder(order({ addonLines: null }), opts)
    expect(res.ok).toBe(false)
  })
})

describe("applyAddonEntitlementsTx (#1049)", () => {
  test("admin tarafından kapatılmış özellikleri yeniden açar, paidAddons'u birleştirir", async () => {
    workshops[0].paidAddons = ["ocrIntake"]
    workshops[1].addons = ["ocrIntake"]
    await applyAddonEntitlementsTx(
      tx as never,
      { id: "w1", organizationId: "org", paidAddons: ["ocrIntake"] },
      ["vinLookup", "ocrIntake"],
    )
    for (const w of workshops) expect(w.addons).toEqual(["vinLookup", "partsCatalog", "ocrIntake"])
    expect(workshops[0].paidAddons).toEqual(["ocrIntake", "vinLookup"])
    expect(workshops[1].paidAddons).toEqual([])
    expect(branchLockIds).toEqual([...branchLockIds].sort())
  })
})

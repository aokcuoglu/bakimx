import { beforeEach, describe, expect, mock, test } from "bun:test"
import type { BillingOrder } from "@prisma/client"

/**
 * #1049 — paket siparişi etkinleştirme: kalemler (addonLines) hesabın
 * yetkilerine yazılır, hakediş tabanı yalnız paket payıdır, kalemsiz eski
 * sipariş eskisi gibi davranır. DB'siz: prisma/audit `mock.module` ile taklit
 * edilir (ikisinin de kendi test dosyası yok); hakediş ve yetki kodu GERÇEK koşar.
 */

type W = {
  id: string
  organizationId: string | null
  kind: "customer"
  createdAt: Date
  planTier: string
  billingCycle: string | null
  extraSeats: number
  currentPeriodEnd: Date | null
  addons: string[]
  paidAddons: string[]
}

let workshops: W[] = []
let orderStatus = "pending_payment"
let commissions: Record<string, unknown>[] = []

const tx = {
  $queryRaw: async () => [],
  workshop: {
    findUnique: async ({ where }: { where: { id: string } }) => workshops.find((w) => w.id === where.id) ?? null,
    findMany: async ({ where }: { where: { organizationId?: string; id?: { in: string[] } } }) =>
      workshops.filter((w) => (where.id ? where.id.in.includes(w.id) : w.organizationId === where.organizationId)),
    update: async ({ where, data }: { where: { id: string }; data: Partial<W> }) => {
      Object.assign(workshops.find((w) => w.id === where.id) as W, data)
    },
  },
  billingOrder: {
    updateMany: async ({ where }: { where: { status: string } }) => {
      if (orderStatus !== where.status) return { count: 0 }
      orderStatus = "confirmed"
      return { count: 1 }
    },
  },
  user: { findMany: async () => [], updateMany: async () => ({ count: 0 }) },
  invite: { findMany: async () => [], updateMany: async () => ({ count: 0 }) },
  technician: { updateMany: async () => ({ count: 0 }) },
  auditLog: { createMany: async () => ({ count: 0 }) },
  salesCommission: {
    findUnique: async () => null,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      commissions.push(data)
      return { id: "c1" }
    },
  },
  salesLead: { findUnique: async () => ({ id: "lead1", advisorId: "adv1" }) },
  salesCommissionRule: { findFirst: async () => ({ id: "rule1", rateBps: 1000 }) },
}

let currentOrder: BillingOrder
mock.module("@/lib/db", () => ({
  prisma: {
    billingOrder: { findUnique: async () => currentOrder },
    workshop: { findUnique: async ({ where }: { where: { id: string } }) => workshops.find((w) => w.id === where.id) ?? null },
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  },
}))
mock.module("@/lib/audit", () => ({ AuditLogAction: async () => undefined }))

const { activateBillingOrder } = await import("./activate")

const FUTURE = new Date(Date.now() + 10 * 86_400_000)
const line = { key: "vinLookup", name: "Şaseden parça", quantity: 1, unitAmountMinor: 39_900, amountMinor: 39_900 }
const opts = { actor: "payment", confirmedByEmail: "tami" } as const

function order(over: Record<string, unknown> = {}): BillingOrder {
  return {
    id: "o1",
    workshopId: "w1",
    type: "upgrade",
    planTier: "pro",
    previousPlanTier: "starter",
    billingCycle: "monthly",
    amountMinor: 139_900,
    addonLines: [line],
    status: "pending_payment",
    createdAt: new Date(),
    netAmountMinor: 116_583,
    ...over,
  } as unknown as BillingOrder
}

function ws(id: string, createdAt: number, over: Partial<W> = {}): W {
  return {
    id,
    organizationId: "org",
    kind: "customer",
    createdAt: new Date(createdAt),
    planTier: "starter",
    billingCycle: "monthly",
    extraSeats: 0,
    currentPeriodEnd: FUTURE,
    addons: [],
    paidAddons: [],
    ...over,
  }
}

beforeEach(() => {
  workshops = [ws("w1", 1), ws("w2", 2)]
  orderStatus = "pending_payment"
  commissions = []
})

describe("activateBillingOrder + addonLines (#1049)", () => {
  test("kalemler hesabın tüm atölyelerine addons yazar, paidAddons birleşir; paket güncellenir", async () => {
    workshops[0].paidAddons = ["ocrIntake"]
    workshops[0].addons = ["ocrIntake"]
    currentOrder = order()
    const res = await activateBillingOrder("o1", opts)
    expect(res.ok).toBe(true)
    expect(workshops[0].addons).toEqual(["vinLookup", "partsCatalog", "ocrIntake"])
    expect(workshops[1].addons).toEqual(["vinLookup", "partsCatalog"])
    expect(workshops[0].paidAddons).toEqual(["ocrIntake", "vinLookup"])
    expect(workshops[1].paidAddons).toEqual([])
    expect(workshops[0].planTier).toBe("pro")
  })

  test("hakediş tabanı yalnız paket payının KDV hariç tutarıdır", async () => {
    currentOrder = order()
    await activateBillingOrder("o1", opts)
    // paket payı 139_900 − 39_900 = 100_000 brüt → 83_333 net (toplam net 116_583 değil)
    expect(commissions).toHaveLength(1)
    expect(commissions[0]).toMatchObject({ calculationBaseMinor: 83_333, calculationRateBps: 1000, calculatedAmountMinor: 8_333 })
  })

  test("kalemsiz eski sipariş eskisi gibi: addons dokunulmaz, taban siparişin net tutarı", async () => {
    workshops[0].addons = ["ocrIntake"]
    currentOrder = order({ addonLines: null, amountMinor: 100_000, netAmountMinor: 83_333 })
    const res = await activateBillingOrder("o1", opts)
    expect(res.ok).toBe(true)
    expect(workshops[0].addons).toEqual(["ocrIntake"])
    expect(workshops[1].addons).toEqual([])
    expect(workshops[0].paidAddons).toEqual([])
    expect(commissions[0]).toMatchObject({ calculationBaseMinor: 83_333 })
  })

  test("zaten işlenmiş sipariş hiçbir şey yazmaz", async () => {
    currentOrder = order({ status: "confirmed" })
    const res = await activateBillingOrder("o1", opts)
    expect(res).toEqual({ ok: false, error: "Bu sipariş zaten işlenmiş." })
    expect(workshops[1].addons).toEqual([])
    expect(commissions).toHaveLength(0)
  })
})

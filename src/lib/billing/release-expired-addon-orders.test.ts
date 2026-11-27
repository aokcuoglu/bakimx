import { beforeEach, expect, mock, test } from "bun:test"

/** #829 — dönemi bitmiş ek özellik siparişi paket yenilemeyi kilitlemez. DB'siz taklit. */

type Cand = {
  id: string
  reference: string
  type: string
  status: string
  workshopId: string
  workshop: { currentPeriodEnd: Date | null }
  paymentTransactions: { status: string }[]
}

let candidates: Cand[] = []
let cancelledIds: string[] = []
let audits: { id: string; action: string; meta: string }[] = []

mock.module("@/lib/db", () => ({
  prisma: {
    billingOrder: {
      findMany: async () => candidates,
      updateMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        cancelledIds = where.id.in
        return { count: where.id.in.length }
      },
    },
  },
}))
mock.module("@/lib/audit", () => ({
  AuditLogAction: async (_w: string, _u: unknown, _e: string, id: string, action: string, meta: string) => {
    audits.push({ id, action, meta })
  },
}))

const { releaseExpiredAddonOrders } = await import("./release-expired-addon-orders")

const now = new Date("2026-01-10T00:00:00Z")
const past = new Date("2026-01-01T00:00:00Z")
const future = new Date("2026-02-01T00:00:00Z")
const cand = (id: string, end: Date | null, txns: string[] = []): Cand => ({
  id,
  reference: `BX-${id}`,
  type: "addon",
  status: "pending_payment",
  workshopId: "w1",
  workshop: { currentPeriodEnd: end },
  paymentTransactions: txns.map((status) => ({ status })),
})

beforeEach(() => {
  candidates = []
  cancelledIds = []
  audits = []
})

test("dönemi bitmiş ve canlı işlemsiz sipariş iptal edilir ve denetim kaydı düşer", async () => {
  candidates = [cand("a", past), cand("b", past, ["failed"])]
  expect(await releaseExpiredAddonOrders({}, now)).toBe(2)
  expect(cancelledIds).toEqual(["a", "b"])
  expect(audits.map((x) => x.action)).toEqual(["billing_order_cancelled", "billing_order_cancelled"])
  expect(audits[0].meta).toContain("addon_period_ended")
})

test("açık dönemdeki ya da canlı kart işlemi olan sipariş engellemeye devam eder", async () => {
  candidates = [cand("live", future), cand("charged", past, ["completed"]), cand("inflight", past, ["initiated"])]
  expect(await releaseExpiredAddonOrders({}, now)).toBe(0)
  expect(cancelledIds).toEqual([])
  expect(audits).toEqual([])
})

import { describe, expect, test } from "bun:test"
import type { Prisma } from "@prisma/client"
import { recalcOrderPayment } from "./recalc"

type Written = { where: unknown; data: Record<string, unknown> }

function fakeTx(order: Record<string, unknown> | null) {
  const writes: Written[] = []
  const calls: string[] = []
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray) => {
      calls.push(`lock:${strings.join("?")}`)
      return []
    },
    serviceOrder: {
      findFirst: async () => {
        calls.push("read")
        return order
      },
      updateMany: async (args: Written) => {
        writes.push(args)
        return { count: 1 }
      },
    },
    collectionPayment: { findMany: async () => [] },
  } as unknown as Prisma.TransactionClient
  return { tx, writes, calls }
}

const item = (totalPrice: number | null) => ({ totalPrice, unitPrice: totalPrice, quantity: 1, type: "labor", includeVat: true })

describe("recalcOrderPayment — saklanan toplam (#831)", () => {
  test("grandTotal kalem + indirim + KDV'den yazılır, workshop kapsamıyla", async () => {
    const { tx, writes } = fakeTx({
      paymentStatus: "unpaid",
      discountAmount: 1000,
      taxRate: 2000,
      items: [item(10000), item(5000)],
    })
    await recalcOrderPayment(tx, "order-1", "ws-1")
    expect(writes).toHaveLength(1)
    expect(writes[0].where).toEqual({ id: "order-1", workshopId: "ws-1" })
    // (15000 - 1000) = 14000; KDV %20 → 16800
    expect(writes[0].data.grandTotal).toBe(16800)
  })

  test("fiyatlı kalem kalmadıysa grandTotal null'a döner", async () => {
    const { tx, writes } = fakeTx({ paymentStatus: "unpaid", discountAmount: null, taxRate: null, items: [item(null)] })
    await recalcOrderPayment(tx, "order-1", "ws-1")
    expect(writes[0].data.grandTotal).toBeNull()
  })

  test("ilk iş sipariş satırını FOR UPDATE ile kilitlemek (okumadan önce)", async () => {
    const { tx, calls } = fakeTx({ paymentStatus: "unpaid", discountAmount: null, taxRate: null, items: [item(100)] })
    await recalcOrderPayment(tx, "order-1", "ws-1")
    expect(calls[0]).toContain("FOR UPDATE")
    expect(calls[0]).toContain('"workshopId"')
    expect(calls[1]).toBe("read")
  })

  test("sipariş bulunamazsa hiçbir şey yazılmaz", async () => {
    const { tx, writes } = fakeTx(null)
    expect(await recalcOrderPayment(tx, "x", "ws-1")).toBeNull()
    expect(writes).toHaveLength(0)
  })
})

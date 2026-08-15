import { beforeEach, describe, expect, it, mock } from "bun:test"

/**
 * BAK-60 — sevkiyatın stok ve denetim sözleşmesi.
 *
 * Bu dosya akışın PARA/STOK tarafını korur; saf geçiş tablosu
 * `src/lib/catalog/bakimx-order.test.ts`'te. Burada doğrulanan dört şey:
 *
 *  • `shipped` işaretlemek stoğu TAM OLARAK BİR KEZ düşürür (invaryant 3).
 *    "Bir kez" iki katmandan gelir: geçiş tablosu `shipped → shipped`'i
 *    reddeder VE yazma `where: { status: mevcut }` koşuluyla yapılır. İkincisi
 *    burada, koşulu eşleşmeyen `updateMany` (count = 0) ile sınanıyor.
 *  • `confirmed` stoğa dokunmaz (invaryant 2).
 *  • `cancelled` hiçbir koşulda stoğa dokunmaz (invaryant 5).
 *  • Sevkiyattaki değişim `BakimxCatalogAudit`'e `stock_change` olarak, öncesi/
 *    sonrası adet ve sipariş kimliğiyle düşer (invaryant 6).
 *
 * DB'siz: prisma `mock.module` ile taklit edilir, `$transaction` geri sarmayı da
 * modeller (callback fırlarsa kaydedilen yazmalar atılır).
 */

const ORDER_ITEMS = [
  { id: "item-1", bakimxProductId: "bx-aku", quantity: 3 },
  { id: "item-2", bakimxProductId: "bx-yag", quantity: 1 },
]

const STOCK: Record<string, number> = {}

/** Siparişin veritabanındaki güncel durumu — koşullu yazma bunu okur. */
let orderStatus = "confirmed"
let orderExists = true
/** Sipariş satırının kaç kez gerçekten hareket ettiği. */
let statusWrites: { to: string }[] = []
let auditRows: Record<string, unknown>[] = []

mock.module("@/lib/admin", () => ({
  requireAdminCapability: async (capability: string) => {
    // Layout guard'ı action'lara miras kalmıyor; kapı burada olmalı.
    expect(capability).toBe("manageCatalog")
    return { user: { id: "admin-1" }, adminRole: "founder" }
  },
}))

mock.module("next/cache", () => ({ revalidatePath: () => {} }))

function tx() {
  // Transaction içinde biriken yazmalar; callback fırlarsa uygulanmaz.
  const pendingStock: { id: string; delta: number }[] = []
  const pendingStatus: { to: string }[] = []
  const pendingAudit: Record<string, unknown>[] = []

  return {
    client: {
      bakimxOrder: {
        updateMany: async (args: {
          where: { id: string; status?: string }
          data: { status: string }
        }) => {
          // Koşullu yazmanın tamamı burada: `status` şartı tutmuyorsa satır
          // hareket etmez ve çağıran `count = 0` görür.
          if (args.where.status && args.where.status !== orderStatus) return { count: 0 }
          pendingStatus.push({ to: args.data.status })
          return { count: 1 }
        },
      },
      bakimxProduct: {
        findMany: async (args: { where: { id: { in: string[] } } }) =>
          args.where.id.in.filter((id) => id in STOCK).map((id) => ({ id })),
        update: async (args: {
          where: { id: string }
          data: { stockQty: { decrement: number } }
        }) => {
          const decrement = args.data.stockQty.decrement
          pendingStock.push({ id: args.where.id, delta: -decrement })
          // Dönen satır transaction içindeki güncel değeri taşır.
          const applied =
            STOCK[args.where.id] +
            pendingStock
              .filter((p) => p.id === args.where.id)
              .reduce((sum, p) => sum + p.delta, 0)
          return { stockQty: applied }
        },
      },
      bakimxCatalogAudit: {
        createMany: async (args: { data: Record<string, unknown>[] }) => {
          pendingAudit.push(...args.data)
          return { count: args.data.length }
        },
      },
    },
    commit() {
      for (const change of pendingStock) STOCK[change.id] += change.delta
      statusWrites.push(...pendingStatus)
      auditRows.push(...pendingAudit)
      if (pendingStatus.length > 0) orderStatus = pendingStatus[pendingStatus.length - 1].to
    },
  }
}

mock.module("@/lib/db", () => ({
  prisma: {
    bakimxOrder: {
      findUnique: async () =>
        orderExists ? { id: "order-1", status: orderStatus, items: ORDER_ITEMS } : null,
    },
    $transaction: async (fn: (client: unknown) => Promise<unknown>) => {
      const scope = tx()
      const result = await fn(scope.client)
      scope.commit()
      return result
    },
  },
}))

const { updateBakimxOrderStatusAction } = await import("./actions")

function reset(status: string) {
  orderStatus = status
  orderExists = true
  statusWrites = []
  auditRows = []
  STOCK["bx-aku"] = 10
  STOCK["bx-yag"] = 2
}

beforeEach(() => reset("confirmed"))

describe("sevkiyat stoğu bir kez düşürür", () => {
  it("shipped işaretlemek her kalemi adedi kadar düşürür", async () => {
    const result = await updateBakimxOrderStatusAction({ orderId: "order-1", status: "shipped" })

    expect(result).toEqual({ ok: true })
    expect(STOCK["bx-aku"]).toBe(7)
    expect(STOCK["bx-yag"]).toBe(1)
  })

  /** İnvaryant 3 — asıl kabul kriteri. */
  it("ikinci kez shipped işaretlemek ikinci düşüm yapmaz", async () => {
    await updateBakimxOrderStatusAction({ orderId: "order-1", status: "shipped" })
    const second = await updateBakimxOrderStatusAction({ orderId: "order-1", status: "shipped" })

    expect(second).toMatchObject({ ok: false })
    expect(STOCK["bx-aku"]).toBe(7)
    expect(STOCK["bx-yag"]).toBe(1)
    expect(statusWrites).toHaveLength(1)
  })

  /**
   * Yarış: geçiş tablosu izin verdi ama satırı bu arada başkası `shipped`
   * yaptı. Koşullu yazma `count = 0` döner, transaction geri sarılır ve stok
   * HİÇ düşmez — `where: { id }` ile yazsaydık ikinci düşüm gerçekleşirdi.
   */
  it("satır bu sırada başkası tarafından taşındıysa stok düşmez", async () => {
    // Action durumu `confirmed` okur; koşullu yazma anında satır artık `shipped`.
    const orderRow = { id: "order-1", status: "confirmed", items: ORDER_ITEMS }
    const dbModule = await import("@/lib/db")
    const original = dbModule.prisma.bakimxOrder.findUnique
    // @ts-expect-error test mock'u
    dbModule.prisma.bakimxOrder.findUnique = async () => {
      orderStatus = "shipped"
      return orderRow
    }

    const result = await updateBakimxOrderStatusAction({ orderId: "order-1", status: "shipped" })

    // @ts-expect-error test mock'u
    dbModule.prisma.bakimxOrder.findUnique = original
    expect(result).toMatchObject({ ok: false })
    expect(STOCK["bx-aku"]).toBe(10)
    expect(auditRows).toEqual([])
  })
})

describe("stoğa dokunmayan geçişler", () => {
  it("confirmed stoğa dokunmaz", async () => {
    reset("requested")
    const result = await updateBakimxOrderStatusAction({ orderId: "order-1", status: "confirmed" })

    expect(result).toEqual({ ok: true })
    expect(STOCK["bx-aku"]).toBe(10)
    expect(auditRows).toEqual([])
  })

  /** İnvaryant 5. */
  it("cancelled hiçbir koşulda stoğa dokunmaz", async () => {
    reset("confirmed")
    const result = await updateBakimxOrderStatusAction({ orderId: "order-1", status: "cancelled" })

    expect(result).toEqual({ ok: true })
    expect(STOCK["bx-aku"]).toBe(10)
    expect(STOCK["bx-yag"]).toBe(2)
    expect(auditRows).toEqual([])
  })

  it("gönderilmiş sipariş iptal edilemez", async () => {
    reset("shipped")
    const result = await updateBakimxOrderStatusAction({ orderId: "order-1", status: "cancelled" })

    expect(result).toMatchObject({ ok: false })
    expect(statusWrites).toEqual([])
  })

  it("requested → shipped atlaması reddedilir", async () => {
    reset("requested")
    const result = await updateBakimxOrderStatusAction({ orderId: "order-1", status: "shipped" })

    expect(result).toMatchObject({ ok: false })
    expect(STOCK["bx-aku"]).toBe(10)
  })
})

describe("denetim kaydı", () => {
  /** İnvaryant 6: yeni tablo açılmadı, mevcut `BakimxCatalogAudit` kullanılıyor. */
  it("sevkiyat her kalem için öncesi/sonrası ve sipariş kimliğiyle yazılır", async () => {
    await updateBakimxOrderStatusAction({ orderId: "order-1", status: "shipped" })

    expect(auditRows).toHaveLength(2)
    expect(auditRows[0]).toMatchObject({
      actorUserId: "admin-1",
      entityType: "product",
      entityId: "bx-aku",
      action: "stock_change",
      beforeJson: { stockQty: 10 },
      afterJson: { stockQty: 7, quantity: 3, reason: "bakimx_order_shipped", orderId: "order-1" },
    })
    expect(auditRows[1]).toMatchObject({
      entityId: "bx-yag",
      beforeJson: { stockQty: 2 },
      afterJson: { stockQty: 1, orderItemId: "item-2" },
    })
  })
})

describe("bulunamayan sipariş", () => {
  it("olmayan sipariş sessizce başarılı sayılmaz", async () => {
    orderExists = false
    const result = await updateBakimxOrderStatusAction({ orderId: "yok", status: "confirmed" })
    expect(result).toMatchObject({ ok: false })
  })
})

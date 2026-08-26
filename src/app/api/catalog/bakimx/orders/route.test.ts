import { beforeEach, describe, expect, it, mock } from "bun:test"

/**
 * `POST /api/catalog/bakimx/orders` SÖZLEŞMESİ (BAK-60):
 *
 *  1. `bakimxCatalog` kapısı kapalıysa 403 + `feature_locked`.
 *  2. Rol / plan kapısı (`requireWritableWorkshop`) fırlarsa 403 — sipariş açılmaz.
 *  3. **Fiyat istemciden gelmez**: gövdeye fiyat konsa bile kaleme sunucunun
 *     çözdüğü iskontolu tutar yazılır (invaryant 1).
 *  4. **Talep stoğa dokunmaz**: uç hiçbir `bakimxProduct` yazması yapmaz
 *     (invaryant 2 — stok yalnız sevkiyatta düşer).
 *  5. `workshopId` OTURUMDAN gelir; gövdedeki bir atölye kimliği yok sayılır.
 *  6. Yayından kalkmış / bulunamayan ürün sipariş edilemez.
 *
 * DB'siz çalışır: repo konvansiyonu gereği prisma `mock.module` ile taklit edilir.
 */

const PRODUCT_ROW = {
  id: "bx-aku",
  sku: "C 27 125",
  name: "Akü 60Ah 540A",
  brandId: "brand-1",
  brandName: "Mutlu",
  categoryKey: "aku",
  barcode: null,
  unit: "adet",
  description: null,
  imageUrl: null,
  oemNumbers: [],
  workshopPriceKurus: 5_000,
  vatRateBps: 2000,
  currency: "TRY",
  stockQty: 4,
  backorderable: false,
  leadTimeDays: null,
}

let planTier = "starter"
let guardError: Error | null = null
let workshopId = "ws-1"
let productExists = true
/** %15 iskontolu atölye: liste 5.000 kuruş → ödenen 4.250 kuruş. */
let discountBps = 1500

/** Kaydedilen her yazma — "talep stoğa dokunmaz" iddiasının kanıtı. */
let writes: { model: string; op: string; data: unknown }[] = []
let createdOrder: Record<string, unknown> | null = null

mock.module("@/lib/auth", () => ({
  requireWritableWorkshop: async (permission: string) => {
    // Kapı çağrılmadan uç çalışmamalı; hangi izinle çağrıldığı da sözleşmenin parçası.
    expect(permission).toBe("parts.purchase")
    if (guardError) throw guardError
    return {
      user: { id: "user-1", workshopId },
      workshop: { id: workshopId, planTier },
    }
  },
  getCurrentUserWithWorkshop: async () => ({
    user: { id: "user-1", workshopId },
    workshop: { id: workshopId, planTier },
  }),
}))

mock.module("@/lib/db", () => ({
  prisma: {
    workshop: {
      findUnique: async () => ({ bakimxDiscountBps: discountBps }),
    },
    bakimxProduct: {
      findFirst: async (args: { select: Record<string, true> }) => {
        if (!productExists) return null
        return Object.fromEntries(
          Object.keys(args.select).map((k) => [k, PRODUCT_ROW[k as keyof typeof PRODUCT_ROW]]),
        )
      },
      // Uç bunlara HİÇ dokunmamalı; dokunursa `writes` doldurur ve test düşer.
      update: async (data: unknown) => {
        writes.push({ model: "bakimxProduct", op: "update", data })
        return {}
      },
      updateMany: async (data: unknown) => {
        writes.push({ model: "bakimxProduct", op: "updateMany", data })
        return { count: 0 }
      },
    },
    bakimxOrder: {
      create: async (args: { data: Record<string, unknown> }) => {
        writes.push({ model: "bakimxOrder", op: "create", data: args.data })
        createdOrder = args.data
        return { id: "order-1", status: "requested", createdAt: new Date("2026-08-15T10:00:00Z") }
      },
    },
  },
}))

const { POST } = await import("./route")

function request(body: unknown): Request {
  return new Request("https://app.bakimx.com/api/catalog/bakimx/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  planTier = "starter"
  guardError = null
  productExists = true
  discountBps = 1500
  writes = []
  createdOrder = null
})

describe("POST /api/catalog/bakimx/orders", () => {
  it("kapı kapalıyken 403 + feature_locked döner, sipariş açılmaz", async () => {
    planTier = "lite"
    workshopId = "ws-locked"

    const response = await POST(request({ items: [{ bakimxProductId: "bx-aku", quantity: 1 }] }))

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: "feature_locked" })
    expect(writes).toEqual([])
  })

  it("rol/plan kapısı reddederse 403 döner", async () => {
    guardError = new Error("Bu işlem için yetkiniz yok.")
    workshopId = "ws-forbidden"

    const response = await POST(request({ items: [{ bakimxProductId: "bx-aku", quantity: 1 }] }))

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ error: "Bu işlem için yetkiniz yok." })
    expect(writes).toEqual([])
  })

  it("fiyatı sunucu çözer — istemcinin gönderdiği tutar yok sayılır", async () => {
    workshopId = "ws-price"

    const response = await POST(
      request({
        items: [
          {
            bakimxProductId: "bx-aku",
            quantity: 2,
            // İstemcinin uydurduğu bedava fiyat; şema bu alanı tanımaz.
            unitPriceKurus: 1,
            listPriceKurus: 1,
          },
        ],
      }),
    )

    expect(response.status).toBe(201)
    const items = (createdOrder?.items as { create: Record<string, unknown>[] }).create
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      bakimxProductId: "bx-aku",
      quantity: 2,
      // 5.000 × (10000 − 1500) / 10000 = 4.250 — atölye kaydından çözülen iskonto.
      unitPriceKurus: 4_250,
      listPriceKurus: 5_000,
      discountBps: 1500,
      nameSnapshot: "Akü 60Ah 540A",
      skuSnapshot: "C 27 125",
    })
  })

  it("talep stoğa DOKUNMAZ — yalnız sipariş satırı yazılır", async () => {
    workshopId = "ws-stock"

    const response = await POST(request({ items: [{ bakimxProductId: "bx-aku", quantity: 3 }] }))

    expect(response.status).toBe(201)
    expect(writes.map((w) => `${w.model}.${w.op}`)).toEqual(["bakimxOrder.create"])
  })

  it("atölye oturumdan gelir — gövdedeki workshopId yok sayılır", async () => {
    workshopId = "ws-session"

    await POST(
      request({
        workshopId: "ws-baskasinin",
        items: [{ bakimxProductId: "bx-aku", quantity: 1 }],
      }),
    )

    expect(createdOrder?.workshopId).toBe("ws-session")
    expect(createdOrder?.createdByUserId).toBe("user-1")
  })

  it("yayından kalkmış ürün sipariş edilemez", async () => {
    workshopId = "ws-missing"
    productExists = false

    const response = await POST(request({ items: [{ bakimxProductId: "bx-yok", quantity: 1 }] }))

    expect(response.status).toBe(404)
    expect(writes).toEqual([])
  })

  it("boş sipariş ve aynı ürünün iki kez gönderilmesi reddedilir", async () => {
    workshopId = "ws-validation"

    expect((await POST(request({ items: [] }))).status).toBe(400)
    expect(
      (
        await POST(
          request({
            items: [
              { bakimxProductId: "bx-aku", quantity: 1 },
              { bakimxProductId: "bx-aku", quantity: 2 },
            ],
          }),
        )
      ).status,
    ).toBe(400)
    expect((await POST(request({ items: [{ bakimxProductId: "bx-aku", quantity: 0 }] }))).status).toBe(400)
    expect(writes).toEqual([])
  })

  it("iskontosuz atölyede kaleme liste fiyatı yazılır", async () => {
    workshopId = "ws-nodiscount"
    discountBps = 0

    await POST(request({ items: [{ bakimxProductId: "bx-aku", quantity: 1 }] }))

    const items = (createdOrder?.items as { create: Record<string, unknown>[] }).create
    expect(items[0]).toMatchObject({ unitPriceKurus: 5_000, listPriceKurus: 5_000, discountBps: 0 })
  })
})

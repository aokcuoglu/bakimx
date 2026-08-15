import { describe, expect, it, mock } from "bun:test"

/**
 * BAK-60 — atölye sipariş listesinin TENANT İZOLASYONU (invaryant 4).
 *
 * `bakimx_orders` katalog tablolarının aksine tenant'a aittir: burada izolasyon
 * "public DTO" ile değil, sorgudaki `workshopId` süzgeciyle sağlanır. Süzgeç
 * düşerse bir atölye komşusunun ne sipariş ettiğini ve hangi fiyata aldığını
 * görür — bu yüzden sorgunun kendisi test ediliyor, dönen satırlar değil.
 */

let capturedWhere: Record<string, unknown> | null = null

const ORDER_ROW = {
  id: "order-1",
  status: "requested",
  note: null,
  createdAt: new Date("2026-08-15T10:00:00Z"),
  shippedAt: null,
  cancelledAt: null,
  items: [
    {
      id: "item-1",
      nameSnapshot: "Akü 60Ah 540A",
      skuSnapshot: "C 27 125",
      quantity: 2,
      unitPriceKurus: 4_250,
      discountBps: 1500,
    },
  ],
}

mock.module("@/lib/db", () => ({
  prisma: {
    bakimxOrder: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        capturedWhere = args.where
        return [ORDER_ROW]
      },
    },
  },
}))

const { getWorkshopBakimxOrders } = await import("./data")

describe("getWorkshopBakimxOrders", () => {
  it("sorgu DAİMA workshopId ile süzülür", async () => {
    await getWorkshopBakimxOrders("ws-1")
    expect(capturedWhere).toEqual({ workshopId: "ws-1" })
  })

  it("ad ve fiyat ürün kartından değil, kalemin anlık görüntüsünden okunur", async () => {
    const [order] = await getWorkshopBakimxOrders("ws-1")

    expect(order.items[0]).toMatchObject({
      name: "Akü 60Ah 540A",
      sku: "C 27 125",
      unitPriceKurus: 4_250,
      discountBps: 1500,
    })
    // 2 × 4.250 = 8.500 kuruş, KDV hariç.
    expect(order.totalKurus).toBe(8_500)
  })
})

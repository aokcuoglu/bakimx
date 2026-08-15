import { describe, expect, it, mock } from "bun:test"

/**
 * BAK-60 REGRESYONU — **kalem ≠ sipariş**.
 *
 * BakımX ürününü iş emrine kalem olarak eklemek bir sipariş TALEBİ oluşturmaz ve
 * BakımX stoğuna dokunmaz. Bu, sipariş akışı eklendikten sonra en kolay
 * bozulacak davranış: "sipariş modeli varken kalem de bir sipariş açsın" ya da
 * "kalem eklenince stok düşsün" değişiklikleri makul görünür ama yanlıştır —
 * atölye bir parçayı teklife koyup işi almayabilir, o yüzden kalem eklemek talep
 * sayılmaz (BAK-30 §9 kararı).
 *
 * Test `addOrderItemAction`'ı GERÇEKTEN çalıştırır ve prisma'ya giden HER yazmayı
 * kaydeder; `bakimxOrder` ya da `bakimxProduct` yazması görülürse düşer. Kaynak
 * taraması değil davranış testi olması bilinçli: aynı regresyon dolaylı bir
 * yardımcı üzerinden de gelebilir.
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
  fitmentScope: "universal" as const,
  fitments: [],
}

/** Prisma'ya giden her yazma — iddianın kanıtı. */
const writes: string[] = []

function recordWrites(model: string) {
  return {
    create: async (args: { data?: Record<string, unknown> }) => {
      writes.push(`${model}.create`)
      return { id: `${model}-1`, ...(args?.data ?? {}) }
    },
    createMany: async () => {
      writes.push(`${model}.createMany`)
      return { count: 0 }
    },
    update: async () => {
      writes.push(`${model}.update`)
      return {}
    },
    updateMany: async () => {
      writes.push(`${model}.updateMany`)
      return { count: 0 }
    },
  }
}

const SERVICE_ORDER = {
  id: "so-1",
  workshopId: "ws-1",
  intakeFormId: "intake-1",
  status: "in_progress",
  workOrderNo: "IS-1",
}

mock.module("@/lib/auth", () => ({
  requireWritableWorkshop: async () => ({
    user: { id: "user-1", workshopId: "ws-1" },
    workshop: { id: "ws-1", planTier: "pro" },
  }),
}))

mock.module("@/lib/features", () => ({ resolveFeature: async () => true }))
mock.module("next/cache", () => ({ revalidatePath: () => {} }))
mock.module("@/lib/audit", () => ({ AuditLogAction: async () => {} }))
mock.module("@/lib/cashbox/recalc", () => ({ recalcOrderPayment: async () => null }))

const txClient = {
  serviceOrderItem: recordWrites("serviceOrderItem"),
  bakimxOrder: recordWrites("bakimxOrder"),
  bakimxOrderItem: recordWrites("bakimxOrderItem"),
  bakimxProduct: recordWrites("bakimxProduct"),
  partStockItem: recordWrites("partStockItem"),
  stockMovement: recordWrites("stockMovement"),
}

mock.module("@/lib/db", () => ({
  prisma: {
    ...txClient,
    serviceOrder: {
      ...recordWrites("serviceOrder"),
      findFirst: async () => SERVICE_ORDER,
    },
    workshop: {
      ...recordWrites("workshop"),
      findUnique: async () => ({ bakimxDiscountBps: 1500 }),
    },
    vehicleIntakeForm: {
      ...recordWrites("vehicleIntakeForm"),
      findUnique: async () => ({ vehicle: { catalogVehicleTypeId: null } }),
    },
    bakimxProduct: {
      ...recordWrites("bakimxProduct"),
      findFirst: async (args: { select: Record<string, true> }) =>
        Object.fromEntries(
          Object.keys(args.select).map((k) => [k, PRODUCT_ROW[k as keyof typeof PRODUCT_ROW]]),
        ),
      findUnique: async () => PRODUCT_ROW,
    },
    $transaction: async (fn: (client: unknown) => Promise<unknown>) => fn(txClient),
  },
}))

const { addOrderItemAction } = await import("./actions")

function itemFormData(): FormData {
  const form = new FormData()
  form.set("serviceOrderId", "so-1")
  form.set("type", "part")
  form.set("name", "İstemcinin uydurduğu ad")
  form.set("quantity", "2")
  form.set("bakimxProductId", "bx-aku")
  form.set("source", "bakimx")
  return form
}

describe("BakımX ürününü iş emrine kalem olarak eklemek", () => {
  it("sipariş talebi OLUŞTURMAZ ve BakımX stoğuna DOKUNMAZ", async () => {
    const result = await addOrderItemAction(itemFormData())

    expect(result).toMatchObject({ success: true })
    // Tek yazma iş emri kalemi; sipariş tablosu ve katalog stoğu el değmemiş.
    expect(writes).toEqual(["serviceOrderItem.create"])
    expect(writes.some((w) => w.startsWith("bakimxOrder"))).toBe(false)
    expect(writes.some((w) => w.startsWith("bakimxProduct"))).toBe(false)
  })
})

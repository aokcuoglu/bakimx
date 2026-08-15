import { describe, expect, it, mock } from "bun:test"

/**
 * BAK-47 — atölye iskontosunun KATALOG OKUMA YOLUNA uygulanması.
 *
 * Sözleşme:
 *  1. `workshopId` verilmezse iskonto uygulanmaz (`displayPriceKurus` = liste fiyatı).
 *  2. `workshopId` verilirse iskonto ATÖLYE KAYDINDAN okunur — istemciden değil.
 *     Bu yüzden testler `workshop.findUnique`'i mockluyor: fiyatı belirleyen tek
 *     kaynak o satırdır.
 *  3. `workshopPriceKurus` (liste) DEĞİŞMEZ; iskonto ayrı alana yazılır ki
 *     yüzeyler "önce/sonra" gösterebilsin.
 *
 * DB'siz çalışır: repo konvansiyonu gereği prisma `mock.module` ile taklit edilir.
 */

const PRODUCT_ROW = {
  id: "p-aku",
  sku: "C 27 125",
  name: "Akü 60Ah",
  brandId: "brand-1",
  brandName: "Mutlu",
  categoryKey: "aku",
  barcode: null,
  unit: "adet",
  description: null,
  imageUrl: null,
  oemNumbers: ["0 986 4B7 035"],
  workshopPriceKurus: 5_000,
  vatRateBps: 2000,
  currency: "TRY",
  stockQty: 4,
  backorderable: false,
  leadTimeDays: null,
}

/** Testler arasında değiştirilen atölye iskontosu (bps). */
let discountBps = 0
/** `workshop.findUnique` çağrıldı mı — "workshopId yoksa sorgu da yok" kanıtı. */
let workshopLookups = 0

mock.module("@/lib/db", () => ({
  prisma: {
    workshop: {
      findUnique: async () => {
        workshopLookups++
        return { bakimxDiscountBps: discountBps }
      },
    },
    bakimxProduct: {
      findMany: async () => [PRODUCT_ROW],
      findFirst: async () => PRODUCT_ROW,
    },
  },
}))

const {
  searchBakimxProducts,
  getVisibleBakimxProduct,
  listBakimxProductsByTecdocCategory,
  matchBakimxProductsByPartNumbers,
  toBakimxProductSummary,
} = await import("./bakimx-catalog")

describe("toBakimxProductSummary — iskonto eşlemesi", () => {
  it("iskonto verilmezse görünen fiyat liste fiyatıdır", () => {
    const summary = toBakimxProductSummary(PRODUCT_ROW)
    expect(summary.workshopPriceKurus).toBe(5_000)
    expect(summary.displayPriceKurus).toBe(5_000)
  })

  it("%15 iskontoda liste fiyatı korunur, görünen fiyat düşer", () => {
    const summary = toBakimxProductSummary(PRODUCT_ROW, 1500)
    expect(summary.workshopPriceKurus).toBe(5_000)
    expect(summary.displayPriceKurus).toBe(4_250)
  })

  it("%100 iskontoda görünen fiyat sıfırlanır", () => {
    expect(toBakimxProductSummary(PRODUCT_ROW, 10000).displayPriceKurus).toBe(0)
  })
})

describe("searchBakimxProducts — iskonto uygulaması", () => {
  it("workshopId yoksa atölye kaydı HİÇ okunmaz ve iskonto uygulanmaz", async () => {
    discountBps = 1500
    workshopLookups = 0

    const [product] = await searchBakimxProducts({})

    expect(workshopLookups).toBe(0)
    expect(product.displayPriceKurus).toBe(5_000)
  })

  it("iskontosuz atölyede fiyat değişmez (regresyon kapısı)", async () => {
    discountBps = 0
    const [product] = await searchBakimxProducts({ workshopId: "ws-1" })

    expect(product.workshopPriceKurus).toBe(5_000)
    expect(product.displayPriceKurus).toBe(5_000)
  })

  it("iskontolu atölyede görünen fiyat düşer, liste fiyatı korunur", async () => {
    discountBps = 2000
    const [product] = await searchBakimxProducts({ workshopId: "ws-2" })

    expect(product.workshopPriceKurus).toBe(5_000)
    expect(product.displayPriceKurus).toBe(4_000)
  })
})

describe("diğer okuma yolları aynı iskontoyu uygular", () => {
  it("getVisibleBakimxProduct — kalem yazımının okuduğu yol", async () => {
    discountBps = 1500
    const product = await getVisibleBakimxProduct("p-aku", null, "ws-2")
    expect(product?.displayPriceKurus).toBe(4_250)
  })

  it("listBakimxProductsByTecdocCategory — TecDoc rozet yolu", async () => {
    discountBps = 1500
    const [product] = await listBakimxProductsByTecdocCategory(101, null, "ws-2")
    expect(product.displayPriceKurus).toBe(4_250)
  })

  it("matchBakimxProductsByPartNumbers — TecDoc eşleştirme yolu", async () => {
    discountBps = 1500
    const matches = await matchBakimxProductsByPartNumbers(["C 27 125"], null, "ws-2")
    expect(matches["C 27 125"]?.displayPriceKurus).toBe(4_250)
  })

  it("üç yol da AYNI fiyatı verir — yüzeyler arası tutarlılık", async () => {
    discountBps = 1500

    const [searched] = await searchBakimxProducts({ workshopId: "ws-2" })
    const single = await getVisibleBakimxProduct("p-aku", null, "ws-2")
    const matches = await matchBakimxProductsByPartNumbers(["C 27 125"], null, "ws-2")

    expect(single?.displayPriceKurus).toBe(searched.displayPriceKurus)
    expect(matches["C 27 125"]?.displayPriceKurus).toBe(searched.displayPriceKurus)
  })
})

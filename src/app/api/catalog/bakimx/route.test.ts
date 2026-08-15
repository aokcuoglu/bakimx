import { describe, expect, it, mock } from "bun:test"

import { buildBakimxProductSearchKey } from "@/lib/parts/bakimx-search-key"

/**
 * `/api/catalog/bakimx/*` uçlarının SÖZLEŞMESİ (BAK-33):
 *   1. `bakimxCatalog` kapısı kapalıysa 403 + `feature_locked`.
 *   2. Yanıt gövdesinde iç maliyet ve içe aktarım alanları BULUNMAZ — tablo
 *      global olduğu için tenant izolasyonunun yerini bu DTO alıyor.
 *   3. Türkçe harf katlaması uçtan uca çalışır: "aku" → "Akü ...".
 *
 * Kapı `partsCatalog` DEĞİL: o kapı ücretli TecDoc kotasını koruyor, bizim
 * kataloğumuz kendi DB'mizden okunuyor.
 */

const PRODUCTS = [
  product({
    id: "p-aku",
    name: "Akü 60Ah 540A",
    brandName: "Mutlu",
    sku: "C 27 125",
    categoryKey: "aku",
    workshopPriceKurus: 248_000,
    costPriceKurus: 190_000,
  }),
  product({
    id: "p-yag",
    name: "Yağ filtresi",
    brandName: "Mann",
    sku: "W712/95",
    categoryKey: "yag-filtresi",
    workshopPriceKurus: 18_500,
    costPriceKurus: 12_000,
  }),
]

function product(input: {
  id: string
  name: string
  brandName: string
  sku: string
  categoryKey: string
  workshopPriceKurus: number
  costPriceKurus: number
}) {
  return {
    ...input,
    brandId: "brand-1",
    tecdocCategoryId: null,
    oemNumbers: [],
    barcode: null,
    unit: "adet",
    description: null,
    imageUrl: null,
    specsJson: { agirlik: "16 kg" },
    searchKey: buildBakimxProductSearchKey(input),
    vatRateBps: 2000,
    currency: "TRY",
    stockQty: 3,
    lowStockQty: 1,
    backorderable: false,
    leadTimeDays: null,
    fitmentScope: "universal" as const,
    isActive: true,
    publishedAt: new Date("2026-08-01T00:00:00Z"),
    lastImportId: "import-1",
    updatedByUserId: "bakimx-staff-1",
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z"),
  }
}

/** Kapının açık/kapalı olması testler arasında değiştirilir. */
let featureEnabled = true
/** Rate limit süreç genelinde tutulduğu için her test kendi atölyesiyle çalışır. */
let workshopId = "ws-0"

mock.module("@/lib/auth", () => ({
  getCurrentUserWithWorkshop: async () => ({
    user: { id: "user-1", workshopId },
    workshop: { id: workshopId, planTier: "starter" },
  }),
}))

mock.module("@/lib/features", () => ({
  resolveFeature: async (_workshopId: string, _tier: string, feature: string) => {
    expect(feature).toBe("bakimxCatalog")
    return featureEnabled
  },
}))

type FakeFindManyArgs = {
  where: { categoryKey?: string; AND?: { searchKey: { contains: string } }[] }
  select: Record<string, true>
  take: number
}

mock.module("@/lib/db", () => ({
  prisma: {
    // BAK-47: fiyat yolu atölyenin iskontosunu buradan okur. Bu paketteki
    // testler iskontosuz atölyeyle çalışır — fiyat beklentileri liste fiyatıdır.
    workshop: {
      findUnique: async () => ({ bakimxDiscountBps: 0 }),
    },
    bakimxProduct: {
      findMany: async (args: FakeFindManyArgs) => {
        const terms = (args.where.AND ?? []).map((clause) => clause.searchKey.contains)
        return PRODUCTS.filter(
          (p) =>
            (!args.where.categoryKey || p.categoryKey === args.where.categoryKey) &&
            terms.every((term) => p.searchKey.includes(term)),
        )
          .slice(0, args.take)
          .map((p) =>
            Object.fromEntries(Object.keys(args.select).map((k) => [k, p[k as keyof typeof p]])),
          )
      },
      groupBy: async () => [
        { categoryKey: "aku", _count: { _all: 1 } },
        { categoryKey: "yag-filtresi", _count: { _all: 1 } },
      ],
    },
  },
}))

const { GET: searchGET } = await import("./search/route")
const { GET: categoriesGET } = await import("./categories/route")

function searchRequest(query: string): Request {
  return new Request(`https://app.bakimx.com/api/catalog/bakimx/search${query}`)
}

describe("GET /api/catalog/bakimx/search", () => {
  it("kapı kapalıyken 403 + feature_locked döner", async () => {
    featureEnabled = false
    workshopId = "ws-locked"
    const response = await searchGET(searchRequest("?q=aku"))
    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({ code: "feature_locked" })

    const categories = await categoriesGET()
    expect(categories.status).toBe(403)
    expect(await categories.json()).toMatchObject({ code: "feature_locked" })
    featureEnabled = true
  })

  it("yanıtta maliyet ve iç alanlar YOK, alış fiyatı + KDV oranı VAR", async () => {
    workshopId = "ws-dto"
    const response = await searchGET(searchRequest("?q=aku"))
    expect(response.status).toBe(200)

    const body = await response.json()
    const raw = JSON.stringify(body)
    for (const forbidden of [
      "costPriceKurus",
      "lowStockQty",
      "lastImportId",
      "updatedByUserId",
      "specsJson",
      "searchKey",
    ]) {
      expect(raw, `${forbidden} atölye yüzeyine sızdı`).not.toContain(forbidden)
    }
    // Maliyetin DEĞERİ de görünmemeli.
    expect(raw).not.toContain("190000")

    expect(body.products).toHaveLength(1)
    expect(body.products[0]).toMatchObject({
      id: "p-aku",
      sku: "C 27 125",
      workshopPriceKurus: 248_000,
      vatRateBps: 2000,
      currency: "TRY",
    })
  })

  it("Türkçe harf katlaması uçtan uca: 'aku' → 'Akü ...'", async () => {
    workshopId = "ws-search"
    const response = await searchGET(searchRequest("?q=aku"))
    const body = await response.json()
    expect(body.products.map((p: { name: string }) => p.name)).toEqual(["Akü 60Ah 540A"])

    // Kategori süzgeci ve ayraç-duyarsız parça no da aynı uçtan çalışır.
    const filtered = await searchGET(searchRequest("?categoryKey=yag-filtresi"))
    expect((await filtered.json()).products.map((p: { id: string }) => p.id)).toEqual(["p-yag"])

    const bySku = await searchGET(searchRequest("?q=c27-125"))
    expect((await bySku.json()).products.map((p: { id: string }) => p.id)).toEqual(["p-aku"])
  })

  it("rate limit atölye başına sayar", async () => {
    workshopId = "ws-rate"
    let limited: Response | null = null
    for (let i = 0; i < 121 && limited == null; i++) {
      const response = await searchGET(searchRequest("?q=aku"))
      if (response.status === 429) limited = response
    }
    expect(limited, "121 istekte kapı hâlâ açık — rate limit devrede değil").not.toBeNull()
    expect(limited!.headers.get("Retry-After")).toBeTruthy()

    // Komşu atölye bundan etkilenmez (kova `bakimx-catalog:<workshopId>`).
    workshopId = "ws-rate-other"
    expect((await searchGET(searchRequest("?q=aku"))).status).toBe(200)
  })
})

describe("GET /api/catalog/bakimx/categories", () => {
  it("iç taksonomiyi etiket ve ürün sayısıyla döner", async () => {
    workshopId = "ws-categories"
    const response = await categoriesGET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      categories: [
        { key: "aku", label: "Akü", productCount: 1 },
        { key: "yag-filtresi", label: "Yağ filtresi", productCount: 1 },
      ],
    })
  })
})

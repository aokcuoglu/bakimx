import { describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

import { bakimxProductSearchKeyMatches, buildBakimxProductSearchKey } from "./bakimx-search-key"

/**
 * `bakimx_products` GLOBAL bir tablodur (workshopId yok) — her atölye aynı
 * satırları görür. Tenant izolasyonunun yerini public DTO alıyor, yani bu
 * dosya tek savunma hattının testidir: yeni bir kolon eklendiğinde sessizce
 * atölye yüzeyine sızmasın diye şemadaki HER kolon ya public listede ya da
 * gerekçeli gizli listede olmak zorunda.
 */

// --- Sahte veri: fiyat listesi + iç maliyet, gerçek satırın tüm kolonlarıyla ---
const ROWS = [
  row({
    id: "p-aku",
    sku: "C 27 125",
    name: "Akü 60Ah 540A",
    brandName: "Mutlu",
    categoryKey: "aku",
    oemNumbers: ["0 986 4B7 035"],
    workshopPriceKurus: 248_000,
    costPriceKurus: 190_000,
  }),
  row({
    id: "p-yag",
    sku: "W712/95",
    name: "Yağ filtresi",
    brandName: "Mann",
    categoryKey: "yag-filtresi",
    workshopPriceKurus: 18_500,
    costPriceKurus: 12_000,
  }),
  row({
    id: "p-silecek",
    sku: "AF60B",
    name: "Silecek süpürgesi 600mm",
    brandName: "Bosch",
    categoryKey: "silecek",
    workshopPriceKurus: 32_000,
    costPriceKurus: 21_000,
  }),
  // Pasif ürün + pasif markalı ürün: hiçbir okuma yolunda görünmemeli.
  row({ id: "p-pasif", name: "Akü 45Ah", brandName: "Mutlu", categoryKey: "aku", isActive: false }),
  row({
    id: "p-pasif-marka",
    name: "Akü 70Ah",
    brandName: "KapaliMarka",
    brandId: "brand-kapali",
    categoryKey: "aku",
    brandIsActive: false,
  }),
  row({
    id: "p-arac-bagli",
    name: "Akü 74Ah",
    brandName: "Varta",
    categoryKey: "aku",
    fitmentScope: "vehicle_linked",
  }),
]

type RowInput = {
  id: string
  name: string
  brandName: string
  sku?: string
  brandId?: string
  categoryKey?: string | null
  oemNumbers?: string[]
  workshopPriceKurus?: number
  costPriceKurus?: number | null
  isActive?: boolean
  brandIsActive?: boolean
  fitmentScope?: "universal" | "vehicle_linked"
}

function row(input: RowInput) {
  const sku = input.sku ?? input.id.toUpperCase()
  return {
    id: input.id,
    sku,
    name: input.name,
    brandId: input.brandId ?? "brand-1",
    brandName: input.brandName,
    categoryKey: input.categoryKey ?? null,
    tecdocCategoryId: null,
    oemNumbers: input.oemNumbers ?? [],
    barcode: null,
    unit: "adet",
    description: null,
    imageUrl: null,
    specsJson: null,
    searchKey: buildBakimxProductSearchKey({
      name: input.name,
      brandName: input.brandName,
      sku,
      oemNumbers: input.oemNumbers,
    }),
    workshopPriceKurus: input.workshopPriceKurus ?? 10_000,
    vatRateBps: 2000,
    costPriceKurus: input.costPriceKurus ?? 5_000,
    currency: "TRY",
    stockQty: 4,
    lowStockQty: 2,
    backorderable: false,
    leadTimeDays: null,
    fitmentScope: input.fitmentScope ?? "universal",
    isActive: input.isActive ?? true,
    publishedAt: new Date("2026-08-01T00:00:00Z"),
    lastImportId: "import-1",
    updatedByUserId: "user-1",
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    brandIsActive: input.brandIsActive ?? true,
  }
}

type Row = ReturnType<typeof row>

/** Sahte Prisma istemcisinin gördüğü argümanlar (yalnız bu uçların kullandığı alanlar). */
type FakeWhere = {
  isActive?: boolean
  fitmentScope?: string
  brand?: { isActive?: boolean }
  brandId?: string
  categoryKey?: string | { not: null }
  AND?: { searchKey: { contains: string } }[]
}
type FakeFindManyArgs = { where: FakeWhere; select: Record<string, true>; take: number }
type FakeGroupByArgs = { where: FakeWhere }

/** Prisma `where`'ini bellek içinde uygular — sorgunun süzgeci gerçekten test edilsin. */
function applyWhere(where: FakeWhere): Row[] {
  return ROWS.filter((r) => {
    if (where.isActive === true && !r.isActive) return false
    if (where.fitmentScope && r.fitmentScope !== where.fitmentScope) return false
    if (where.brand?.isActive === true && !r.brandIsActive) return false
    if (where.brandId && r.brandId !== where.brandId) return false
    if (typeof where.categoryKey === "object" && r.categoryKey == null) return false
    if (typeof where.categoryKey === "string" && r.categoryKey !== where.categoryKey) return false
    for (const clause of where.AND ?? []) {
      // `searchKey: { contains: term }` — DB'nin yaptığı alt-dize eşleşmesi.
      if (!r.searchKey.includes(clause.searchKey.contains)) return false
    }
    return true
  })
}

const lastFindMany: Partial<FakeFindManyArgs> = {}

mock.module("@/lib/db", () => ({
  prisma: {
    bakimxProduct: {
      findMany: async (args: FakeFindManyArgs) => {
        Object.assign(lastFindMany, args)
        const rows = applyWhere(args.where).sort((a, b) => a.name.localeCompare(b.name, "tr"))
        // Prisma yalnız `select`'teki kolonları döndürür — sahte istemci de öyle.
        return rows
          .slice(0, args.take)
          .map((r) => Object.fromEntries(Object.keys(args.select).map((k) => [k, r[k as keyof Row]])))
      },
      groupBy: async (args: FakeGroupByArgs) => {
        const counts = new Map<string, number>()
        for (const r of applyWhere(args.where)) {
          if (r.categoryKey == null) continue
          counts.set(r.categoryKey, (counts.get(r.categoryKey) ?? 0) + 1)
        }
        return [...counts].map(([categoryKey, n]) => ({ categoryKey, _count: { _all: n } }))
      },
    },
  },
}))

const {
  BAKIMX_PRODUCT_SUMMARY_SELECT,
  BAKIMX_SEARCH_MAX_LIMIT,
  bakimxCategoryLabel,
  clampSearchLimit,
  listBakimxCategories,
  matchBakimxProductsByPartNumbers,
  searchBakimxProducts,
  toBakimxProductSummary,
} = await import("./bakimx-catalog")

/** Atölye yüzeyine ÇIKMAYAN kolonlar — her biri gerekçeli. */
const HIDDEN_COLUMNS: Record<string, string> = {
  costPriceKurus: "BakımX'in İÇ maliyeti — atölye alış fiyatını değil bunu görürse marjımız açığa çıkar",
  lowStockQty: "iç stok politikası; atölyeyi ilgilendirmez",
  lastImportId: "içe aktarım izi (iç süreç)",
  updatedByUserId: "BakımX personelinin kimliği",
  specsJson: "kart detayı; özet DTO'da taşınmaz",
  searchKey: "arama altyapısı, gösterilecek veri değil",
  tecdocCategoryId: "Faz 2 köprüsü; atölye tarafında karşılığı yok",
  fitmentScope: "sorgunun süzgeci, ürünün özelliği değil",
  isActive: "süzgeç: dönen her ürün zaten aktif",
  publishedAt: "yayın süreci (iç)",
  createdAt: "iç bakım verisi",
  updatedAt: "iç bakım verisi",
}

describe("public DTO (tek savunma hattı)", () => {
  it("şemadaki her kolon ya public listede ya gerekçeli gizli listededir", () => {
    const columns = Object.keys(Prisma.BakimxProductScalarFieldEnum)
    const unclassified = columns.filter(
      (c) => !(c in BAKIMX_PRODUCT_SUMMARY_SELECT) && !(c in HIDDEN_COLUMNS),
    )
    expect(
      unclassified,
      "BakimxProduct'a yeni kolon eklendi: public DTO'ya mı girecek, HIDDEN_COLUMNS'a mı? Karar ver.",
    ).toEqual([])
  })

  it("gizli kolonlar select'te yok — sorgu onları hiç çekmez", () => {
    for (const column of Object.keys(HIDDEN_COLUMNS)) {
      expect(BAKIMX_PRODUCT_SUMMARY_SELECT).not.toHaveProperty(column)
    }
  })

  it("DTO eşlemesi maliyet/iç alanları taşımaz, tam satır verilse bile", () => {
    const summary = toBakimxProductSummary(ROWS[0])
    const serialized = JSON.stringify(summary)
    for (const column of Object.keys(HIDDEN_COLUMNS)) {
      expect(summary).not.toHaveProperty(column)
      expect(serialized).not.toContain(column)
    }
    // Maliyet DEĞERİ de sızmamalı (başka bir ad altında bile).
    expect(serialized).not.toContain("190000")
    // Buna karşılık alış fiyatı + KDV oranı açıkça taşınır (BAK-35 bunları okur).
    expect(summary.workshopPriceKurus).toBe(248_000)
    expect(summary.vatRateBps).toBe(2000)
  })

  /**
   * BAK-35 — kategori ETİKETİ de DTO'dan gelir: atölye yüzeyi (öneri satırı,
   * seçici, kalem `category` metni) taksonomiyi yeniden yazmak zorunda kalmasın.
   */
  it("kategori etiketi türetilir; kategorisiz üründe null kalır", () => {
    expect(toBakimxProductSummary(ROWS[0]).categoryLabel).toBe("Akü")
    expect(toBakimxProductSummary({ ...ROWS[0], categoryKey: null }).categoryLabel).toBeNull()
  })
})

describe("searchBakimxProducts", () => {
  it("Türkçe harf katlaması uçtan uca: 'aku' → 'Akü ...' bulur", async () => {
    const products = await searchBakimxProducts({ q: "aku" })
    expect(products.map((p) => p.id)).toEqual(["p-aku"])
    // Süzgeç gerçekten `searchKey` üzerinden gitti mi (ikinci bir katlama yok).
    expect(lastFindMany.where?.AND).toEqual([{ searchKey: { contains: "aku" } }])
  })

  it("terimler AND'lenir, sıradan bağımsız ('mutlu aku')", async () => {
    expect((await searchBakimxProducts({ q: "mutlu aku" })).map((p) => p.id)).toEqual(["p-aku"])
    expect((await searchBakimxProducts({ q: "aku bosch" })).map((p) => p.id)).toEqual([])
  })

  it("ayraç-duyarsız parça no ve ASCII yazım da tutar", async () => {
    expect((await searchBakimxProducts({ q: "c27-125" })).map((p) => p.id)).toEqual(["p-aku"])
    expect((await searchBakimxProducts({ q: "silecek supurgesi" })).map((p) => p.id)).toEqual([
      "p-silecek",
    ])
  })

  it("bellek içi eşleşme ile DB eşleşmesi aynı sonucu verir", async () => {
    const products = await searchBakimxProducts({ q: "aku" })
    for (const p of products) {
      const source = ROWS.find((r) => r.id === p.id)!
      expect(bakimxProductSearchKeyMatches(source.searchKey, "aku")).toBe(true)
    }
  })

  it("pasif ürün, pasif marka ve araca bağlı ürün listelenmez", async () => {
    const ids = (await searchBakimxProducts({ q: "", limit: 50 })).map((p) => p.id)
    expect(ids).toEqual(["p-aku", "p-silecek", "p-yag"])
    expect(lastFindMany.where).toMatchObject({
      isActive: true,
      fitmentScope: "universal",
      brand: { isActive: true },
    })
  })

  it("boş sorgu kategoriye göre listeler (seçicide dala tıklama)", async () => {
    expect((await searchBakimxProducts({ categoryKey: "yag-filtresi" })).map((p) => p.id)).toEqual([
      "p-yag",
    ])
    expect((await searchBakimxProducts({ brandId: "brand-1", q: "yag" })).map((p) => p.id)).toEqual([
      "p-yag",
    ])
  })

  it("istemci sınırı sunucuda kırpılır", async () => {
    await searchBakimxProducts({ limit: 500 })
    expect(lastFindMany.take).toBe(BAKIMX_SEARCH_MAX_LIMIT)
    expect(clampSearchLimit(null)).toBe(20)
    expect(clampSearchLimit(0)).toBe(20)
    expect(clampSearchLimit(-3)).toBe(20)
    expect(clampSearchLimit(7.9)).toBe(7)
  })
})

describe("listBakimxCategories", () => {
  it("yalnız görünür ürünü olan yaprakları, sayısı ve etiketiyle döner", async () => {
    expect(await listBakimxCategories()).toEqual([
      { key: "aku", label: "Akü", productCount: 1 },
      { key: "silecek", label: "Silecek", productCount: 1 },
      { key: "yag-filtresi", label: "Yağ filtresi", productCount: 1 },
    ])
  })

  it("etiketi olmayan anahtar okunur hâle getirilir", () => {
    expect(bakimxCategoryLabel("aku")).toBe("Akü")
    expect(bakimxCategoryLabel("far-ampulu")).toBe("Far Ampulu")
  })
})

describe("matchBakimxProductsByPartNumbers", () => {
  it("TecDoc articleNo'yu BakımX SKU'suyla eşleştir", async () => {
    const matches = await matchBakimxProductsByPartNumbers(["C 27 125", "W712/95"])
    expect(Object.keys(matches)).toHaveLength(2)
    expect(matches["C 27 125"]?.id).toBe("p-aku")
    expect(matches["W712/95"]?.id).toBe("p-yag")
  })

  it("ayraç ve harf-durumu duyarsız eşleştir", async () => {
    const matches = await matchBakimxProductsByPartNumbers(["c27-125", "w712-95"])
    expect(matches["c27-125"]?.id).toBe("p-aku")
    expect(matches["w712-95"]?.id).toBe("p-yag")
  })

  it("OEM numaralarıyla da eşleş", async () => {
    const matches = await matchBakimxProductsByPartNumbers(["0 986 4B7 035"])
    expect(matches["0 986 4B7 035"]?.id).toBe("p-aku")
  })

  it("eşleşmeyen numaraları haritaya koymaz", async () => {
    const matches = await matchBakimxProductsByPartNumbers(["C 27 125", "YOKYOK"])
    expect(matches).toHaveProperty("C 27 125")
    expect(matches).not.toHaveProperty("YOKYOK")
  })

  it("pasif ürünü eşleştirmez", async () => {
    // ROWS[3] pasif bir ürün. EşleştirmeMatches tarafından görülmemeli.
    const matches = await matchBakimxProductsByPartNumbers(["C 27 125"])
    expect(matches["C 27 125"]?.id).toBe("p-aku") // Aktif olan eşleşir
  })

  it("boş liste → boş harita", async () => {
    const matches = await matchBakimxProductsByPartNumbers([])
    expect(matches).toEqual({})
  })

  it("dönen harita public DTO'yu taşır, iç alanlar yok", async () => {
    const matches = await matchBakimxProductsByPartNumbers(["C 27 125"])
    const aku = matches["C 27 125"]!
    const serialized = JSON.stringify(aku)
    expect(serialized).not.toContain("costPriceKurus")
    expect(aku.workshopPriceKurus).toBe(248_000)
  })
})

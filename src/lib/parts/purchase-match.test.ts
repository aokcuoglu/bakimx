import { expect, test } from "bun:test"
import {
  findPartNumberMatches,
  purchaseMatchFields,
  purchaseMatchKey,
  PURCHASE_MATCH_LIMIT,
} from "./purchase-match"
import type { StockPartLite } from "@/lib/parts/suggestions"
import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"
import type { BakimxProductSummary } from "@/lib/parts/bakimx-catalog"

const article = (
  no: string,
  over: Partial<ArticleSearchResult> = {},
): ArticleSearchResult =>
  ({
    tecdocArticleId: 1000 + no.length,
    articleNo: no,
    productName: "Turbo hortumu",
    supplierName: "BBR",
    supplierId: 7,
    imageUrl: null,
    categoryId: 42,
    categoryName: "Turbo",
    matchedOems: [],
    ...over,
  }) as ArticleSearchResult

const bakimx = (id: string, over: Partial<BakimxProductSummary> = {}): BakimxProductSummary => ({
  id,
  sku: `BX-${id}`,
  name: `BakımX ${id}`,
  brandId: "brand-1",
  brandName: "Mutlu",
  categoryKey: "aku",
  categoryLabel: "Akü",
  barcode: null,
  unit: "adet",
  description: null,
  imageUrl: null,
  oemNumbers: [],
  workshopPriceKurus: 248_000,
  displayPriceKurus: 248_000,
  discountBps: 0,
  vatRateBps: 2000,
  currency: "TRY",
  stockQty: 4,
  backorderable: false,
  leadTimeDays: null,
  ...over,
})

const stock = (id: string, over: Partial<StockPartLite> = {}): StockPartLite => ({
  id,
  name: `Stok ${id}`,
  sku: null,
  oemNo: null,
  brand: null,
  stockQty: 3,
  unit: "adet",
  salePrice: null,
  ...over,
})

test("ayraç ve harf durumu farkı eşleşmeyi bozmaz", () => {
  const out = findPartNumberMatches("c-27-125", { articles: [article("C 27 125")] })
  expect(out).toHaveLength(1)
  expect(out[0]!.kind).toBe("catalog")
})

/**
 * Uyarının çekirdeği: alt-dize DEĞİL birebir eşleşme. "0986" yazınca onlarca
 * Bosch parçası uyarı olarak çıksaydı usta yanlış parçaya bağlanırdı.
 */
test("alt-dize eşleşmesi uyarı üretmez", () => {
  expect(findPartNumberMatches("0986", { articles: [article("0 986 4B7 035")] })).toEqual([])
})

test("kutunun üstündeki OEM numarası da eşleşir", () => {
  const out = findPartNumberMatches("KK2Q-6C301-CA", {
    articles: [article("BBR-1", { matchedOems: ["KK2Q 6C301 CA"] })],
  })
  expect(out).toHaveLength(1)
})

test("çok kısa girdi hiç sorgulanmaz", () => {
  expect(findPartNumberMatches("12", { articles: [article("12")] })).toEqual([])
})

test("boş/eksik numaralı kayıt boş sorguyla eşleşmez", () => {
  expect(findPartNumberMatches("", { stockParts: [stock("s1")] })).toEqual([])
  expect(findPartNumberMatches("ABC123", { stockParts: [stock("s1")] })).toEqual([])
})

test("sıra TecDoc → BakımX", () => {
  const out = findPartNumberMatches("ABC123", {
    articles: [article("ABC-123")],
    bakimxProducts: [bakimx("b1", { sku: "abc123" })],
  })
  expect(out.map((m) => m.kind)).toEqual(["catalog", "bakimx"])
})

/** Aynı numara katalogda çıktıysa stok kartı ikinci kez uyarı olarak gösterilmez. */
test("katalog eşleşmesi varsa stok satırı elenir", () => {
  const out = findPartNumberMatches("ABC123", {
    articles: [article("ABC-123")],
    stockParts: [stock("s1", { sku: "ABC123" })],
  })
  expect(out.map((m) => m.kind)).toEqual(["catalog"])
})

test("yalnız stokta varsa stok eşleşmesi döner", () => {
  const out = findPartNumberMatches("ABC123", { stockParts: [stock("s1", { oemNo: "abc-123" })] })
  expect(out.map((m) => m.kind)).toEqual(["stock"])
})

test("eşleşme sayısı sınırlanır", () => {
  const many = Array.from({ length: PURCHASE_MATCH_LIMIT + 3 }, (_, i) =>
    article("ABC123", { tecdocArticleId: i + 1 }),
  )
  expect(findPartNumberMatches("ABC123", { articles: many })).toHaveLength(PURCHASE_MATCH_LIMIT)
})

/**
 * BAK-84 invaryantı: yalnız TecDoc eşleşmesi kalemde kimlik bağı kurar.
 * BakımX/stok eşleşmesi bilgilendirmedir — `bakimxProductId`/`partId` yazılsaydı
 * satır `source=bakimx` sayılır ya da stok düşerdi.
 */
test("yalnız TecDoc eşleşmesi tecdocArticleId yazar", () => {
  const cat = purchaseMatchFields({ kind: "catalog", article: article("A1") })
  expect(cat.tecdocArticleId).toBe(article("A1").tecdocArticleId)
  expect(cat.categoryId).toBe(42)

  const bx = purchaseMatchFields({ kind: "bakimx", product: bakimx("b1") })
  expect(bx.tecdocArticleId).toBeNull()
  expect(bx.categoryId).toBeNull()
  expect(bx.sku).toBe("BX-b1")

  const st = purchaseMatchFields({ kind: "stock", part: stock("s1", { oemNo: "OEM-9" }) })
  expect(st.tecdocArticleId).toBeNull()
  expect(st.sku).toBe("OEM-9")
})

test("liste anahtarları kaynaklar arasında çakışmaz", () => {
  const keys = [
    purchaseMatchKey({ kind: "catalog", article: article("A1") }),
    purchaseMatchKey({ kind: "bakimx", product: bakimx("1") }),
    purchaseMatchKey({ kind: "stock", part: stock("1") }),
  ]
  expect(new Set(keys).size).toBe(3)
})

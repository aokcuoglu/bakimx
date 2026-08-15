import { expect, test } from "bun:test"
import {
  buildPartSuggestions,
  suggestionFitsVehicle,
  suggestionKey,
  suggestionLabel,
  type StockPartLite,
} from "./suggestions"
import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"
import type { BakimxProductSummary } from "@/lib/parts/bakimx-catalog"

const article = (no: string, name = "Katalog parçası"): ArticleSearchResult =>
  ({
    tecdocArticleId: no.length,
    articleNo: no,
    productName: name,
    supplierName: "BBR",
    imageUrl: null,
    categoryId: 1,
    categoryName: "Filtre",
  }) as unknown as ArticleSearchResult

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

test("sıra TecDoc → BakımX → atölye stoğu", () => {
  const out = buildPartSuggestions([article("A1")], [bakimx("b1")], [stock("s1")])
  expect(out.map((s) => s.kind)).toEqual(["catalog", "bakimx", "stock"])
})

/** #181'in çekirdeği: yalnız TecDoc satırı "araca uygun" sayılır, uyarı bu bayrağa bağlı. */
test("araca uygunluk yalnız TecDoc satırında doğrulanmıştır", () => {
  const [cat, bx, stk] = buildPartSuggestions([article("A1")], [bakimx("b1")], [stock("s1")])
  expect(suggestionFitsVehicle(cat)).toBe(true)
  // BakımX ürünü araçtan BAĞIMSIZ (Faz 1'de yalnız `universal`) — uygunluk iddiası yok.
  expect(suggestionFitsVehicle(bx)).toBe(false)
  expect(suggestionFitsVehicle(stk)).toBe(false)
})

test("aynı parça numarası iki kaynakta varsa stok satırı elenir", () => {
  const out = buildPartSuggestions([article("C 27 125")], [], [stock("s1", { sku: "c27125" })])
  expect(out).toHaveLength(1)
  expect(out[0].kind).toBe("catalog")
})

test("BakımX SKU'suna eşit stok kartı da elenir", () => {
  const out = buildPartSuggestions(
    [],
    [bakimx("b1", { sku: "C 27 125" })],
    [stock("s1", { sku: "c27-125" })],
  )
  expect(out.map((s) => s.kind)).toEqual(["bakimx"])
})

test("eşleşme OEM numarası üzerinden de kurulur", () => {
  expect(buildPartSuggestions([article("C27125")], [], [stock("s1", { oemNo: "C-27-125" })])).toHaveLength(1)
  expect(
    buildPartSuggestions([], [bakimx("b1", { sku: "C27125" })], [stock("s1", { oemNo: "C-27-125" })]),
  ).toHaveLength(1)
})

/** İki katalog aynı parçayı taşıyabilir; teklifleri farklı olduğu için ikisi de kalır. */
test("TecDoc ile BakımX arasında tekilleştirme yapılmaz", () => {
  const out = buildPartSuggestions([article("C27125")], [bakimx("b1", { sku: "C 27 125" })], [])
  expect(out.map((s) => s.kind)).toEqual(["catalog", "bakimx"])
})

test("numarası olmayan stok kartı elenmez", () => {
  const out = buildPartSuggestions([article("C27125")], [bakimx("b1")], [stock("s1")])
  expect(out).toHaveLength(3)
})

test("farklı numaralı stok kartı korunur", () => {
  const out = buildPartSuggestions([article("C27125")], [bakimx("b1")], [stock("s1", { sku: "X999" })])
  expect(out).toHaveLength(3)
  expect(out[2].kind).toBe("stock")
})

test("katalog boşken BakımX ve stok kartları tek başına listelenir", () => {
  const out = buildPartSuggestions([], [bakimx("b1")], [stock("s1"), stock("s2")])
  expect(out.map((s) => s.kind)).toEqual(["bakimx", "stock", "stock"])
  expect(out.every((s) => !suggestionFitsVehicle(s))).toBe(true)
})

/** Kapı kapalı atölye: BakımX listesi hep boş gelir → liste eski hâline döner. */
test("BakımX listesi boşken diğer iki kaynak hiç etkilenmez", () => {
  const out = buildPartSuggestions([article("A1")], [], [stock("s1")])
  expect(out.map((s) => s.kind)).toEqual(["catalog", "stock"])
})

test("etiket ve anahtar üç kaynak için de üretilir", () => {
  const [cat, bx, stk] = buildPartSuggestions(
    [article("A1", "Hava filtresi")],
    [bakimx("b1", { name: "Akü 60Ah" })],
    [stock("s1")],
  )
  expect(suggestionLabel(cat)).toBe("Hava filtresi")
  expect(suggestionLabel(bx)).toBe("Akü 60Ah")
  expect(suggestionLabel(stk)).toBe("Stok s1")
  expect(suggestionKey(cat)).toStartWith("c-")
  expect(suggestionKey(bx)).toBe("b-b1")
  expect(suggestionKey(stk)).toBe("s-s1")
})

test("üç kaynak da boşsa liste boş kalır", () => {
  expect(buildPartSuggestions([], [], [])).toEqual([])
})

import { expect, test } from "bun:test"
import {
  buildPartSuggestions,
  suggestionFitsVehicle,
  suggestionKey,
  suggestionLabel,
  type StockPartLite,
} from "./suggestions"
import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"

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

test("katalog sonuçları stok kartlarından önce gelir", () => {
  const out = buildPartSuggestions([article("A1")], [stock("s1")])
  expect(out.map((s) => s.kind)).toEqual(["catalog", "stock"])
})

/** #181'in çekirdeği: stok satırı "araca uygun" sayılmaz, uyarı bu bayrağa bağlı. */
test("yalnız katalog satırı araca uygun sayılır", () => {
  const [cat, stk] = buildPartSuggestions([article("A1")], [stock("s1")])
  expect(suggestionFitsVehicle(cat)).toBe(true)
  expect(suggestionFitsVehicle(stk)).toBe(false)
})

test("aynı parça numarası iki kaynakta varsa stok satırı elenir", () => {
  const out = buildPartSuggestions([article("C 27 125")], [stock("s1", { sku: "c27125" })])
  expect(out).toHaveLength(1)
  expect(out[0].kind).toBe("catalog")
})

test("eşleşme OEM numarası üzerinden de kurulur", () => {
  const out = buildPartSuggestions([article("C27125")], [stock("s1", { oemNo: "C-27-125" })])
  expect(out).toHaveLength(1)
})

test("numarası olmayan stok kartı elenmez", () => {
  const out = buildPartSuggestions([article("C27125")], [stock("s1")])
  expect(out).toHaveLength(2)
})

test("farklı numaralı stok kartı korunur", () => {
  const out = buildPartSuggestions([article("C27125")], [stock("s1", { sku: "X999" })])
  expect(out).toHaveLength(2)
  expect(out[1].kind).toBe("stock")
})

test("katalog boşken stok kartları tek başına listelenir", () => {
  const out = buildPartSuggestions([], [stock("s1"), stock("s2")])
  expect(out).toHaveLength(2)
  expect(out.every((s) => !suggestionFitsVehicle(s))).toBe(true)
})

test("etiket ve anahtar iki kaynak için de üretilir", () => {
  const [cat, stk] = buildPartSuggestions([article("A1", "Hava filtresi")], [stock("s1")])
  expect(suggestionLabel(cat)).toBe("Hava filtresi")
  expect(suggestionLabel(stk)).toBe("Stok s1")
  expect(suggestionKey(cat)).toStartWith("c-")
  expect(suggestionKey(stk)).toBe("s-s1")
})

test("iki kaynak da boşsa liste boş kalır", () => {
  expect(buildPartSuggestions([], [])).toEqual([])
})

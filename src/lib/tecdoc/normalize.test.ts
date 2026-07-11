import { describe, test, expect, it } from "bun:test"
import { normalizeCategories, normalizeArticles, dedupeBrands } from "./normalize"
import { TecdocError } from "./types"
import categoriesFixture from "./fixtures/categories-v2.json"
import articlesFixture from "./fixtures/articles.json"

test("normalizeCategories: real v2 fixture → sorted tree with ids and Turkish names", () => {
  const tree = normalizeCategories(categoriesFixture)
  expect(tree.length).toBeGreaterThan(5)
  // sorted tr-aware at every level
  const names = tree.map((n) => n.name)
  expect([...names].sort((a, b) => a.localeCompare(b, "tr"))).toEqual(names)

  const fren = tree.find((n) => n.name === "Fren tertibatı")
  expect(fren).toBeDefined()
  expect(fren!.id).toBe(100006)
  const disk = fren!.children.find((n) => n.name === "Diskli fren")
  expect(disk).toBeDefined()
  const balata = disk!.children.find((n) => n.name === "Fren balatası")
  expect(balata).toMatchObject({ id: 100030, children: [] }) // leaf: children [] (raw'da boş array)
})

test("normalizeCategories: leaf children may be raw empty array, node map otherwise", () => {
  const tree = normalizeCategories({
    categories: {
      A: { categoryId: 1, categoryName: "A", children: { B: { categoryId: 2, categoryName: "B", children: [] } } },
    },
  })
  expect(tree).toEqual([{ id: 1, name: "A", children: [{ id: 2, name: "B", children: [] }] }])
})

test("normalizeCategories: shape mismatch → TecdocError provider_error", () => {
  expect(() => normalizeCategories({ foo: "bar" })).toThrow(TecdocError)
  expect(() => normalizeCategories(null)).toThrow(TecdocError)
})

test("normalizeArticles: real fixture → ArticleSummary fields", () => {
  const articles = normalizeArticles(articlesFixture)
  expect(articles).toHaveLength(30)
  const first = articles[0]
  expect(first).toMatchObject({
    tecdocArticleId: 15430114,
    articleNo: "EST-50-00-0354",
    productName: "Fren balata seti, diskli fren",
    supplierName: "4X4 ESTANFI",
    supplierId: 6372,
  })
  expect(first.imageUrl).toStartWith("https://")
})

test("normalizeArticles: null articles (empty category) → empty list; garbage throws", () => {
  expect(normalizeArticles({ countArticles: null, articles: null })).toEqual([])
  expect(normalizeArticles({ countArticles: 0, articles: [] })).toEqual([])
  expect(() => normalizeArticles({ articles: [{ bogus: true }] })).toThrow(TecdocError)
})

describe("dedupeBrands", () => {
  it("null supplierId'yi dışlar, supplierId'ye göre tekilleştirir, tr-sıralar", () => {
    const rows = [
      { supplierId: 10, supplierName: "MANN-FILTER" },
      { supplierId: 5, supplierName: "BOSCH" },
      { supplierId: 10, supplierName: "MANN-FILTER" },
      { supplierId: null, supplierName: "İSİMSİZ" },
    ]
    expect(dedupeBrands(rows)).toEqual([
      { supplierId: 5, name: "BOSCH" },
      { supplierId: 10, name: "MANN-FILTER" },
    ])
  })
  it("boş girişte boş dizi", () => {
    expect(dedupeBrands([])).toEqual([])
  })
})

import { expect, test } from "bun:test"
import { getirbakimMatchesArticle, nestGetirbakimUnderArticles } from "./match"
import type { GetirbakimProduct } from "./types"

const product = (over: Partial<GetirbakimProduct> = {}): GetirbakimProduct => ({
  contractVersion: "1.1",
  sourceProductId: "gb-1",
  id: "gb-1",
  partNo: "10210",
  manufacturerPartNumber: { value: "1987435194", normalized: "1987435194" },
  name: "FILTRE",
  brandName: "Bosch",
  categoryName: "Yağ filtresi",
  oemNumbers: ["10210"],
  references: [{ type: "OEM", value: "10-02-210", normalized: "1002210", brand: "ASHIKA" }],
  exactFitment: { requestedVehicleTypeId: null, status: "NOT_REQUESTED", matchedVehicleTypeIds: [] },
  imageUrl: null,
  listPriceKurus: 79605,
  b2bPriceKurus: 79605,
  discountBps: 0,
  vatRateBps: 2000,
  currency: "TRY",
  stockQty: 0,
  availability: "SUPPLYABLE",
  lastSyncedAt: null,
  ...over,
})

test("TecDoc parça no GetirBakım OEM/referansıyla eşleşir", () => {
  expect(getirbakimMatchesArticle(product(), { tecdocArticleId: 1, articleNo: "10210" })).toBe(true)
  expect(getirbakimMatchesArticle(product(), { tecdocArticleId: 1, articleNo: "10-02-210" })).toBe(true)
  expect(getirbakimMatchesArticle(product(), { tecdocArticleId: 1, articleNo: "1987435194" })).toBe(true)
  expect(getirbakimMatchesArticle(product(), { tecdocArticleId: 1, articleNo: "XXXX" })).toBe(false)
})

test("eşleşen GetirBakım ürünü TecDoc satırının altına yuvalanır, diğeri bağımsız kalır", () => {
  const japko = { tecdocArticleId: 11, articleNo: "10210" }
  const other = { tecdocArticleId: 12, articleNo: "ZZZ" }
  const nestedProduct = product({ id: "gb-nested" })
  const standalone = product({
    id: "gb-alone",
    partNo: "OC90",
    manufacturerPartNumber: { value: "OC90", normalized: "OC90" },
    oemNumbers: [],
    references: [],
  })
  const result = nestGetirbakimUnderArticles([japko, other], [nestedProduct, standalone])
  expect(result.nested[11]?.map((p) => p.id)).toEqual(["gb-nested"])
  expect(result.nested[12]).toBeUndefined()
  expect(result.standalone.map((p) => p.id)).toEqual(["gb-alone"])
})

test("bir GetirBakım ürünü yalnız bir TecDoc satırına yuvalanır", () => {
  const a = { tecdocArticleId: 1, articleNo: "10210" }
  const b = { tecdocArticleId: 2, articleNo: "10210" }
  const result = nestGetirbakimUnderArticles([a, b], [product()])
  expect(result.nested[1]).toHaveLength(1)
  expect(result.nested[2]).toBeUndefined()
  expect(result.standalone).toEqual([])
})

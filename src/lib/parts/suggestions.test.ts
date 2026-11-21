import { expect, test } from "bun:test"
import {
  buildPartSuggestions,
  suggestionFitsVehicle,
  suggestionKey,
  suggestionLabel,
  suggestionMatchesVehicle,
  type StockPartLite,
} from "./suggestions"
import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"
import type { BakimxProductSummary } from "@/lib/parts/bakimx-catalog"
import type { GetirbakimProduct } from "@/lib/parts/getirbakim/types"

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

const getirbakim = (id: string, level: "guaranteed" | "likely" | "unknown" = "unknown"): GetirbakimProduct => ({
  contractVersion: "1.2", sourceProductId: id, id, partNo: `GB-${id}`,
  manufacturerPartNumber: null, name: `GetirBakım ${id}`, brandName: "GB",
  categoryName: null, oemNumbers: [], references: [],
  exactFitment: level === "unknown"
    ? { requestedVehicleTypeId: null, status: "NOT_REQUESTED", matchedVehicleTypeIds: [] }
    : level === "guaranteed"
      ? { requestedVehicleTypeId: 7, status: "CONFIRMED", matchedVehicleTypeIds: [7] }
      : { requestedVehicleTypeId: 7, status: "NOT_CONFIRMED", matchedVehicleTypeIds: [] },
  fitmentLevel: level,
  imageUrl: null, listPriceKurus: 10000, b2bPriceKurus: 9000, discountBps: 1000,
  vatRateBps: 2000, currency: "TRY", stockQty: 1, availability: "IN_STOCK",
  lastSyncedAt: null,
})

test("uyumu bilinmeyen GetirBakım: TecDoc → BakımX → GetirBakım → atölye stoğu", () => {
  const out = buildPartSuggestions([article("A1")], [bakimx("b1")], [stock("s1")], [getirbakim("g1")])
  expect(out.map((s) => s.kind)).toEqual(["catalog", "bakimx", "getirbakim", "stock"])
})

/** #755: vitrin kutusu gibi — araca uyan GetirBakım en önde, uymayanlar yine listede. */
test("araca uyan GetirBakım satırları en önde, uymayanlar BakımX'ten sonra", () => {
  const out = buildPartSuggestions(
    [article("A1")],
    [bakimx("b1")],
    [stock("s1")],
    [getirbakim("u1"), getirbakim("l1", "likely"), getirbakim("g1", "guaranteed"), getirbakim("u2")],
  )
  expect(out.map(suggestionKey)).toEqual([
    "g-g1", "g-l1", "c-2", "b-b1", "g-u1", "g-u2", "s-s1",
  ])
})

test("GetirBakım tam uyumu doğrulanmış uyum sayılır; muhtemel uyum yalnız süzgeçte kalır", () => {
  const [guaranteed, likely, , unknown] = buildPartSuggestions(
    [], [bakimx("b1")], [],
    [getirbakim("g1", "guaranteed"), getirbakim("l1", "likely"), getirbakim("u1")],
  )
  expect(suggestionFitsVehicle(guaranteed)).toBe(true)
  expect(suggestionFitsVehicle(likely)).toBe(false)
  expect(suggestionFitsVehicle(unknown)).toBe(false)
  expect(suggestionMatchesVehicle(guaranteed)).toBe(true)
  expect(suggestionMatchesVehicle(likely)).toBe(true)
  expect(suggestionMatchesVehicle(unknown)).toBe(false)
})

test("'Yalnız bu araca uyanlar' süzgeci TecDoc + uyan GetirBakım bırakır", () => {
  const out = buildPartSuggestions(
    [article("A1")], [bakimx("b1")], [stock("s1")],
    [getirbakim("u1"), getirbakim("g1", "guaranteed"), getirbakim("l1", "likely")],
  ).filter(suggestionMatchesVehicle)
  expect(out.map(suggestionKey)).toEqual(["g-g1", "g-l1", "c-2"])
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

test("etiket ve anahtar seçilebilir üç kaynak için de üretilir", () => {
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

test("GetirBakım satırı için kaynaklar arası benzersiz etiket ve anahtar üretilir", () => {
  const suggestion = buildPartSuggestions([], [], [], [getirbakim("g1")])[0]
  expect(suggestionLabel(suggestion)).toBe("GetirBakım g1")
  expect(suggestionKey(suggestion)).toBe("g-g1")
  expect(suggestionFitsVehicle(suggestion)).toBe(false)
})

test("dört kaynak da boşsa liste boş kalır", () => {
  expect(buildPartSuggestions([], [], [])).toEqual([])
})

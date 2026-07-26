import { test, expect } from "bun:test"
import { normalizeArticleDetail, normalizeCrossRefs } from "./normalize"
import { TecdocError } from "./types"
import detailFixture from "./fixtures/article-detail.json"
import crossRefsFixture from "./fixtures/article-cross-refs.json"

test("normalizeArticleDetail: gerçek fixture → Türkçe ölçütler, OEM, EAN, görsel", () => {
  const d = normalizeArticleDetail(detailFixture, 0)

  expect(d.tecdocArticleId).toBe(7858423)
  expect(d.articleNo).toBe("L40594")
  expect(d.productName).toBe("Yağ filtresi")
  expect(d.supplierName).toBe("1A FIRST AUTOMOTIVE")
  expect(d.imageUrl).toContain("https://")

  // langId=23 → ölçüt adları Türkçe
  expect(d.specs).toContainEqual({ name: "Dış çap [mm]", value: "68" })
  expect(d.specs).toContainEqual({ name: "Dişli ölçüsü", value: "M20X1,5" })

  expect(d.oems[0]).toMatchObject({ brand: "HONDA" })
  expect(d.eanNumbers).toEqual(["8033977007781"])
})

test("normalizeArticleDetail: uyumlu araç kaydı vehicleId ile bulunabilir", () => {
  const d = normalizeArticleDetail(detailFixture, 0)
  const fitment = d.compatibleCars.find((c) => c.vehicleId === 129947)
  expect(fitment).toMatchObject({
    manufacturerName: "HONDA",
    typeEngineName: "1.6 i-VTEC (FC5)",
    constructionIntervalStart: "2016-09-01",
    constructionIntervalEnd: "2022-12-01",
  })
})

test("normalizeArticleDetail: eksik alt listeler boş diziye düşer, patlamaz", () => {
  const d = normalizeArticleDetail({ article: { articleNo: "X1" } }, 4242)
  expect(d).toMatchObject({
    tecdocArticleId: 4242, // articleId yoksa çağıranın verdiği id
    articleNo: "X1",
    productName: "Parça",
    supplierName: "",
    supplierId: null,
    imageUrl: null,
    specs: [],
    oems: [],
    eanNumbers: [],
    compatibleCars: [],
  })
})

test("normalizeArticleDetail: boş adlı/değersiz ölçüt ve numarasız OEM elenir", () => {
  const d = normalizeArticleDetail(
    {
      article: {
        articleId: 1,
        allSpecifications: [
          { criteriaName: "Ağırlık [kg]", criteriaValue: 0.5 }, // sayı değer → string'e
          { criteriaName: "Boş", criteriaValue: "" },
          { criteriaName: "", criteriaValue: "12" },
        ],
        oemNo: [{ oemBrand: "BMW", oemDisplayNo: "123" }, { oemBrand: "VW", oemDisplayNo: "" }],
      },
    },
    1
  )
  expect(d.specs).toEqual([{ name: "Ağırlık [kg]", value: "0.5" }])
  expect(d.oems).toEqual([{ brand: "BMW", number: "123" }])
})

test("normalizeArticleDetail: eanNumbers dizi de olabilir; vehicleId'siz uyumluluk kaydı atlanır", () => {
  const d = normalizeArticleDetail(
    {
      article: {
        articleId: 5,
        eanNo: { eanNumbers: ["111", " 222 "] },
        compatibleCars: [{ vehicleId: 7, modelName: "A" }, { modelName: "id yok" }],
      },
    },
    5
  )
  expect(d.eanNumbers).toEqual(["111", "222"])
  expect(d.compatibleCars).toEqual([
    {
      vehicleId: 7,
      manufacturerName: "",
      modelName: "A",
      typeEngineName: "",
      constructionIntervalStart: null,
      constructionIntervalEnd: null,
    },
  ])
})

test("normalizeArticleDetail: şekil tutmazsa TecdocError", () => {
  expect(() => normalizeArticleDetail({ nope: true }, 1)).toThrow(TecdocError)
})

test("normalizeCrossRefs: gerçek fixture → marka adına göre tr-sıralı", () => {
  const refs = normalizeCrossRefs(crossRefsFixture)
  expect(refs.length).toBeGreaterThan(3)
  const names = refs.map((r) => r.supplierName)
  expect([...names].sort((a, b) => a.localeCompare(b, "tr"))).toEqual(names)
  expect(refs[0]).toHaveProperty("articleNo")
})

test("normalizeCrossRefs: numarasız kayıt atlanır, (marka,no) tekrarı tekilleşir", () => {
  const refs = normalizeCrossRefs({
    articles: [
      { articleId: 1, articleNo: "A1", supplierName: "BOSCH", articleProductName: "Filtre" },
      { articleId: 2, articleNo: "A1", supplierName: "BOSCH" }, // aynı çift
      { articleId: 3, articleNo: "", supplierName: "MANN" }, // numarasız
      { articleId: null, articleNo: "B2", supplierName: "ASHIKA" },
    ],
  })
  expect(refs).toEqual([
    { tecdocArticleId: null, articleNo: "B2", supplierName: "ASHIKA", productName: "", imageUrl: null },
    { tecdocArticleId: 1, articleNo: "A1", supplierName: "BOSCH", productName: "Filtre", imageUrl: null },
  ])
})

test("normalizeCrossRefs: boş liste → boş dizi", () => {
  expect(normalizeCrossRefs({ countArticles: 0, articles: null })).toEqual([])
})

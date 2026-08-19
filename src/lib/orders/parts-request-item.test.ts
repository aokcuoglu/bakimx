import { test, expect } from "bun:test"
import { partsRequestToItemFields, partsRequestTypeLabel } from "./parts-request-item"

const partRequest = {
  type: "part",
  partName: "Yağ filtresi",
  partSku: "W 712/75",
  brand: "MANN-FILTER",
  quantity: 2,
  note: "sol ön",
  tecdocArticleId: 12345,
  supplierName: null,
  estimatedPriceKurus: null,
}

test("katalog parçası kalemi: tip part, kaynak catalog, TecDoc bağı taşınır", () => {
  const item = partsRequestToItemFields(partRequest)
  expect(item.type).toBe("part")
  expect(item.source).toBe("catalog")
  expect(item.sku).toBe("W 712/75")
  expect(item.brand).toBe("MANN-FILTER")
  expect(item.tecdocArticleId).toBe(12345)
  expect(item.quantity).toBe(2)
})

test("serbest parça talebi manual kaynakla açılır", () => {
  const item = partsRequestToItemFields({ ...partRequest, tecdocArticleId: null })
  expect(item.type).toBe("part")
  expect(item.source).toBe("manual")
  expect(item.tecdocArticleId).toBeNull()
})

test("parça kaleminde tedarikçi/alış tutarı YAZILMAZ (bugünkü davranış)", () => {
  const item = partsRequestToItemFields({
    ...partRequest,
    // Şema tipe göre temizlese de eşleme kendi başına da güvenli olmalı.
    supplierName: "Ahmet Rot Balans",
    estimatedPriceKurus: 90000,
  })
  expect(item.supplierName).toBeNull()
  expect(item.purchasePriceKurus).toBeNull()
})

const laborRequest = {
  type: "external_labor",
  partName: "Rot balans ayarı",
  partSku: null,
  brand: null,
  quantity: 1,
  note: "ön takım",
  tecdocArticleId: null,
  supplierName: "Ahmet Rot Balans",
  estimatedPriceKurus: 90000,
}

test("dış işçilik kalemi external_labor tipiyle açılır", () => {
  const item = partsRequestToItemFields(laborRequest)
  expect(item.type).toBe("external_labor")
  expect(item.name).toBe("Rot balans ayarı")
  expect(item.note).toBe("ön takım")
})

test("dış işçilikte katalog alanları kaleme taşınmaz", () => {
  const item = partsRequestToItemFields({
    ...laborRequest,
    partSku: "OEM-1",
    brand: "MANN-FILTER",
    tecdocArticleId: 999,
  })
  expect(item.sku).toBeNull()
  expect(item.brand).toBeNull()
  expect(item.tecdocArticleId).toBeNull()
})

test("tahmini tutar MALİYET tarafına yazılır, tedarikçi adı taşınır", () => {
  const item = partsRequestToItemFields(laborRequest)
  expect(item.purchasePriceKurus).toBe(90000)
  expect(item.supplierName).toBe("Ahmet Rot Balans")
})

test("dış işçilik kaynağı manual — Dış Alımlar ekranına düşmez", () => {
  // source: "purchase" olsaydı satır /purchases listesine ve KPI'larına girerdi.
  expect(partsRequestToItemFields(laborRequest).source).toBe("manual")
})

test("tutar/firma boş bırakılabilir", () => {
  const item = partsRequestToItemFields({ ...laborRequest, supplierName: null, estimatedPriceKurus: null })
  expect(item.supplierName).toBeNull()
  expect(item.purchasePriceKurus).toBeNull()
})

test("hiçbir tipte partId üretilmez → stok düşümü yok", () => {
  for (const req of [partRequest, laborRequest]) {
    expect(Object.keys(partsRequestToItemFields(req))).not.toContain("partId")
  }
})

test("tip etiketi kullanıcıya dönük metinlerde ortak kaynaktır", () => {
  expect(partsRequestTypeLabel("external_labor")).toBe("Dış işçilik")
  expect(partsRequestTypeLabel("part")).toBe("Parça")
})

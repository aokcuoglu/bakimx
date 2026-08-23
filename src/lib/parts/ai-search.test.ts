import { expect, test } from "bun:test"
import { aiPartSearchAllowedRole, mockAiPartSearchQuery, normalizeAiSearchQuery } from "./ai-search"
import { bakimxProductSearchTerms, buildBakimxProductSearchKey } from "./bakimx-search-key"

test("AI parça araması yalnız yönetici ve ustaya açıktır", () => {
  expect(aiPartSearchAllowedRole("owner")).toBe(true)
  expect(aiPartSearchAllowedRole("usta")).toBe(true)
  expect(aiPartSearchAllowedRole("manager")).toBe(false)
  expect(aiPartSearchAllowedRole("cirak")).toBe(false)
})

test("model sorgusu güvenli uzunluğa ve tek boşluğa indirgenir", () => {
  expect(normalizeAiSearchQuery("  ön   fren balatası ", "x")).toBe("ön fren balatası")
  expect(normalizeAiSearchQuery(null, " yağ filtresi ")).toBe("yağ filtresi")
  expect(normalizeAiSearchQuery("x".repeat(200), "y")).toHaveLength(120)
})

test("mock doğal dil kalıbını katalog sorgusundan çıkarır", () => {
  const query = mockAiPartSearchQuery("Bu araç için Mann Filtre yağ filtresi arıyorum")
  expect(query).toBe("Mann Filtre yağ filtresi")

  // QA regresyonu: ekran görüntüsündeki istek, örnek Mann ürün kartının arama
  // anahtarında gerçekten pozitif eşleşmeye dönüşür.
  const productKey = buildBakimxProductSearchKey({
    name: "Yağ filtresi",
    brandName: "Mann",
    sku: "W712",
  })
  expect(bakimxProductSearchTerms(query).every((term) => productKey.includes(term))).toBe(true)
})

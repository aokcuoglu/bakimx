import { describe, expect, test } from "bun:test"

const source = await Bun.file(new URL("./supplier-price-dialog.tsx", import.meta.url)).text()

describe("SupplierPriceDialog real-offer UI contract", () => {
  test("exact part-number endpointini kullanır ve demo fixture'a düşmez", () => {
    expect(source).toContain("/api/catalog/getirbakim/offers?partNo=")
    expect(source).not.toContain("getMockSupplierPrices")
  })

  test("gerçek teklifler salt okunur ve bağlayıcı olmayan fiyat olarak etiketlidir", () => {
    expect(source).not.toContain("Bu fiyatı kullan")
    expect(source).toContain("bilgilendirme amaçlıdır ve bağlayıcı teklif değildir")
  })

  test("yükleme, eşleşme yok, teklif yok ve upstream hata durumlarını sunar", () => {
    expect(source).toContain("yükleniyor")
    expect(source).toContain('result?.status === "no_match"')
    expect(source).toContain('result?.status === "no_offers"')
    expect(source).toContain('result?.status === "upstream_error"')
  })

  test("çakışan parça numarası sonuçlarını sourceProductId ile ayrı gruplar", () => {
    expect(source).toContain("products.map((product)")
    expect(source).toContain("key={product.sourceProductId}")
    expect(source).toContain("product.brandName")
    expect(source).toContain("product.manufacturerPartNumber.value")
  })
})

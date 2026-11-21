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

  test("transactional uygunluğu olmayan teklif erişilebilir biçimde seçilemez", () => {
    expect(source).toContain("!transactional.canRequestQuote")
    expect(source).toContain("transactional.selectionLabel")
    expect(source).toContain('aria-hidden="true"')
  })

  test("yükleme, bağlantı yok, eşleşme yok, teklif yok ve upstream hata durumlarını sunar", () => {
    expect(source).toContain("yükleniyor")
    expect(source).toContain('result?.status === "not_configured"')
    expect(source).toContain("GetirBakım katalog bağlantısı bu ortamda etkin değil")
    expect(source).toContain('result?.status === "no_match"')
    expect(source).toContain('result?.status === "no_offers"')
    expect(source).toContain('result?.status === "upstream_error"')
    expect(source).toContain('role={error ? "alert" : undefined}')
    expect(source).toContain('aria-live={error ? "assertive" : undefined}')
  })

  test("offer, quote ve purchase yanıtlarını endpoint-specific guardlarla doğrular", () => {
    expect(source).toContain("readOfferResponse(response)")
    expect(source).toContain("readQuoteResponse(response)")
    expect(source).toContain("readPurchaseResponse(response)")
  })

  test("çakışan parça numarası sonuçlarını sourceProductId ile ayrı gruplar", () => {
    expect(source).toContain("products.map((product)")
    expect(source).toContain("key={product.sourceProductId}")
    expect(source).toContain("product.brandName")
    expect(source).toContain("product.manufacturerPartNumber.value")
  })

  test("sunucu onay kimliğini yollar ve her bağlayıcı değişiklikte eski onayı temizler", () => {
    expect(source).toContain("confirmationToken: quote.confirmationToken")
    expect(source).not.toContain("expectedPolicyVersion: quote.policyVersion")
    expect(source).not.toContain("expectedExpiresAt: quote.expiresAt")
    expect(source).toContain("RECONFIRMATION_REQUIRED_CODES.has(error.code)")
    expect(source).toContain("setQuote(null)")
    // Contract v2.0 quotes carry no policy version; the total shows shipping instead.
    expect(source).not.toContain("quote.policyVersion")
    expect(source).toContain("Kargo (KDV dahil)")
    expect(source).toContain("yeniden açıkça onaylayın")
  })

  test("iskonto değişikliği sonrası eskimiş teklif gönderilmez; canlı teklif yeniden alınır (#760)", () => {
    expect(source).toContain("if (isQuoteExpired(quote))")
    const expiredBranch = source.slice(source.indexOf("if (isQuoteExpired(quote))"))
    expect(expiredBranch.slice(0, 400)).toContain("await chooseOffer(selected.product, selected.offer)")
    expect(expiredBranch.slice(0, 400)).toContain("setConfirmationChanged(true)")
    expect(source).toContain("GetirBakım iş ortağı iskontosu dahil")
    expect(source).toContain("Teklifi yeniden al")
  })

  test("GetirBakım'ın partner iskontosunu gösterir ama fiyatı kendisi hesaplamaz (#760)", () => {
    expect(source).toContain("product.discountBps > 0")
    expect(source).toContain("formatDiscountPercent(selected.product.discountBps)")
    expect(source).toContain("expectedUnitNetKurus: quote.lines[0].unitNetKurus")
    // Bağlayıcı fiyat GetirBakım teklifinden gelir; yerel iskonto çarpımı yok.
    expect(source).not.toMatch(/discountBps\s*\/\s*10000/)
    expect(source).not.toMatch(/\*\s*\(1\s*-/)
  })
})

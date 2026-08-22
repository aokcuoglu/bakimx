import { describe, expect, test } from "bun:test"
import {
  readOfferResponse, readPurchaseResponse, readQuoteResponse, SupplierResponseError,
} from "./supplier-price-responses"

const offer = {
  selectedOfferId: "offer-1", supplierDisplayName: "Tedarikçi", informationalPriceKurus: 100,
  currency: "TRY", vatRateBps: 2000, availability: "IN_STOCK", stockQty: 2, lastSyncedAt: null,
}
const product = {
  sourceProductId: "product-1", brandName: "Marka",
  manufacturerPartNumber: { value: "103803", normalized: "103803" }, offers: [offer],
}
const quote = {
  bindingNetKurus: 100, bindingVatKurus: 20, bindingGrossKurus: 120, unitNetKurus: 100,
  currency: "TRY", policyVersion: "v1", expiresAt: "2026-08-22T20:00:00Z", confirmationToken: "opaque",
}

describe("supplier price endpoint responses", () => {
  test("preserves valid offer, quote and purchase success contracts", async () => {
    await expect(readOfferResponse(Response.json({ status: "matched", normalizedPartNo: "103803", products: [product] })))
      .resolves.toEqual({ status: "matched", normalizedPartNo: "103803", products: [product] })
    await expect(readQuoteResponse(Response.json({ quote }))).resolves.toEqual(quote)
    await expect(readPurchaseResponse(Response.json({ procurement: { id: "local-1", externalOrderId: "remote-1", partnerStatus: "REQUESTED" } }, { status: 201 })))
      .resolves.toBeUndefined()
  })

  test.each([
    ["offer", () => readOfferResponse(Response.json({ status: "matched", normalizedPartNo: "103803" }))],
    ["quote", () => readQuoteResponse(Response.json({ quote: {} }))],
    ["purchase", () => readPurchaseResponse(Response.json({ procurement: {} }, { status: 201 }))],
  ])("fails closed for a wrong-shape %s success response", async (_name, read) => {
    await expect(read()).rejects.toThrow("Sunucudan geçersiz yanıt alındı")
  })

  test.each([
    { status: "matched", normalizedPartNo: "103803", products: [{ ...product, offers: [] }] },
    { status: "no_offers", normalizedPartNo: "103803", products: [product] },
  ])("fails closed for an offer status/products mismatch", async (body) => {
    await expect(readOfferResponse(Response.json(body))).rejects.toThrow("Sunucudan geçersiz yanıt alındı")
  })

  test.each([
    ["non-JSON", new Response("<html>gateway</html>", { status: 200, headers: { "content-type": "text/html" } })],
    ["malformed JSON", new Response("not-json", { status: 200, headers: { "content-type": "application/json" } })],
  ])("does not leak raw body or parser details for %s", async (_name, response) => {
    const error = await readQuoteResponse(response.clone()).catch((caught) => caught)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain("Sunucudan geçersiz yanıt alındı")
    expect(error.message).not.toContain("gateway")
    expect(error.message).not.toContain("JSON")
  })

  test.each([
    ["offer", () => readOfferResponse(Response.json({ status: "upstream_error", normalizedPartNo: "103803" }, { status: 502 }))],
    ["quote", () => readQuoteResponse(Response.json({ error: "Fiyat alınamadı." }, { status: 409 }))],
    ["purchase", () => readPurchaseResponse(Response.json({ error: "Yeniden onaylayın.", code: "QUOTE_CHANGED" }, { status: 409 }))],
  ])("returns a controlled error for a valid non-2xx %s response", async (_name, read) => {
    await expect(read()).rejects.toBeInstanceOf(SupplierResponseError)
  })

  test("preserves a validated reconfirmation code", async () => {
    const error = await readPurchaseResponse(Response.json({ error: "Yeniden onaylayın.", code: "QUOTE_CHANGED" }, { status: 409 })).catch((caught) => caught)
    expect(error).toBeInstanceOf(SupplierResponseError)
    expect(error.code).toBe("QUOTE_CHANGED")
  })

  test("fails closed for a malformed non-2xx envelope", async () => {
    await expect(readPurchaseResponse(Response.json({ error: 42 }, { status: 502 }))).rejects.toThrow("Sunucudan geçersiz yanıt alındı")
  })
})

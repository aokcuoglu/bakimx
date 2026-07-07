import { expect, test } from "bun:test"
import { buildTamiPaymentBody } from "./request-builder"

const input = {
  orderId: "VRFTEST01", amountMinor: 100, callbackUrl: "http://x/cb",
  card: { holderName: "TEST KART", number: "5406697543211173", cvv: "423", expireMonth: 4, expireYear: 2027 },
  contact: { name: "Test", surName: "Kart", email: "t@x.com", phone: "05346484808", ip: "85.34.78.112", city: "İstanbul", address: "Adres 1" },
  basketItemName: "Kart doğrulama",
}

test("amount SAYI ve kuruş→TL; zorunlu sabit alanlar mevcut", () => {
  const b = buildTamiPaymentBody(input)
  expect(b.amount).toBe(1)                      // 100 kuruş → 1 (number!)
  expect(b.motoInd).toBe(false)
  expect(b.paymentChannel).toBe("WEB")
  expect(b.paymentGroup).toBe("PRODUCT")
  expect(b.installmentCount).toBe(1)
  expect(b.currency).toBe("TRY")
})

test("sepet: tek VIRTUAL kalem, toplam=amount, gerçek alan adları", () => {
  const item = buildTamiPaymentBody(input).basket.basketItems[0]
  expect(item).toEqual({ itemId: "VRFTEST01", name: "Kart doğrulama", itemType: "VIRTUAL",
    category: "SaaS", subCategory: "Abonelik", numberOfProducts: 1, unitPrice: 1, totalPrice: 1 })
})

test("buyer/adres genişletilmiş alanlar; kuruşlu tutar ondalık üretir", () => {
  const b = buildTamiPaymentBody({ ...input, amountMinor: 129900 })
  expect(b.amount).toBe(1299)
  expect(buildTamiPaymentBody({ ...input, amountMinor: 129950 }).amount).toBe(1299.5)
  expect(b.buyer.registrationDate).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  expect(b.billingAddress.contactName).toBe("Test Kart")
  expect(b.billingAddress.country).toBe("Türkiye")
})

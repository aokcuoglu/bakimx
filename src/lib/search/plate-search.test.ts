import { expect, test } from "bun:test"
import { isPlateOrCustomerQueryReady, plateSearchTerm } from "@/lib/search/plate-search"

test("plateSearchTerm: ayraçları atar, büyütür", () => {
  expect(plateSearchTerm("34 abc 123")).toBe("34ABC123")
  expect(plateSearchTerm("34-ABC-123")).toBe("34ABC123")
})

test("plateSearchTerm: zaten bitişik plaka aynen döner", () => {
  expect(plateSearchTerm("34ABC123")).toBe("34ABC123")
})

test("plateSearchTerm: kısmi giriş de sadeleşir", () => {
  expect(plateSearchTerm("34 ab")).toBe("34AB")
})

test("plateSearchTerm: üç karakterden kısa terim aramaya girmez", () => {
  expect(plateSearchTerm("34")).toBe("")
  expect(plateSearchTerm("3 4")).toBe("")
  expect(plateSearchTerm("  ")).toBe("")
})

test("plateSearchTerm: Türkçe harfler korunur", () => {
  expect(plateSearchTerm("06 ğüş 12")).toBe("06ĞÜŞ12")
})

test("isPlateOrCustomerQueryReady: yalnız il kodu aramaz, il kodu + harf arar", () => {
  expect(isPlateOrCustomerQueryReady("34")).toBe(false)
  expect(isPlateOrCustomerQueryReady("3")).toBe(false)
  expect(isPlateOrCustomerQueryReady("34 ")).toBe(false)
  expect(isPlateOrCustomerQueryReady("34-")).toBe(false)
  expect(isPlateOrCustomerQueryReady("345")).toBe(false)
  expect(isPlateOrCustomerQueryReady("34 K")).toBe(true)
  expect(isPlateOrCustomerQueryReady("34k")).toBe(true)
  expect(isPlateOrCustomerQueryReady("06 Ç")).toBe(true)
  expect(isPlateOrCustomerQueryReady("34 MHP 923")).toBe(true)
})

test("isPlateOrCustomerQueryReady: üç haneli il kodu plaka sayılmaz", () => {
  expect(isPlateOrCustomerQueryReady("340 A")).toBe(false)
})

test("isPlateOrCustomerQueryReady: rakamdan oluşan giriş telefon uzunluğunda aranır", () => {
  expect(isPlateOrCustomerQueryReady("053211")).toBe(false)
  expect(isPlateOrCustomerQueryReady("0532111")).toBe(true)
  expect(isPlateOrCustomerQueryReady("0532 111 22 33")).toBe(true)
})

test("isPlateOrCustomerQueryReady: müşteri adı olduğu gibi aranır, boş giriş aranmaz", () => {
  expect(isPlateOrCustomerQueryReady("ali")).toBe(true)
  expect(isPlateOrCustomerQueryReady("M")).toBe(true)
  expect(isPlateOrCustomerQueryReady("")).toBe(false)
  expect(isPlateOrCustomerQueryReady("   ")).toBe(false)
})

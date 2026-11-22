import { expect, test } from "bun:test"
import { normalizeDemoRequestBody, validateDemoRequestBody } from "./validate"

test("demo sayfası kuralları değişmedi", () => {
  expect(validateDemoRequestBody({ name: "Ali Veli", phone: "05321234567" })).toEqual({
    businessName: "İşletme adı en az 2 karakter olmalıdır",
    city: "Şehir seçimi yapın",
    monthlyVehicles: "Aylık araç adedi seçin",
  })
  expect(validateDemoRequestBody({
    name: "Ali Veli", businessName: "Yıldız Oto", phone: "05321234567", city: "İstanbul", monthlyVehicles: "50-100",
  })).toEqual({})
})

test("landing_callback yalnız ad ve telefon ister", () => {
  expect(validateDemoRequestBody({ source: "landing_callback", name: "Ali Veli", phone: "0532 123 45 67" })).toEqual({})
  const errors = validateDemoRequestBody({ source: "landing_callback", name: "A", phone: "x" })
  expect(Object.keys(errors).sort()).toEqual(["name", "phone"])
})

test("bilinmeyen kaynak demo sayfası kurallarına düşer", () => {
  const body = { source: "baska" as never, name: "Ali Veli", phone: "05321234567" }
  expect(validateDemoRequestBody(body)).toHaveProperty("city")
})

test("landing_callback kaydı boş dizeler ve kaynak notuyla normalize edilir", () => {
  expect(normalizeDemoRequestBody({ source: "landing_callback", name: " Ali Veli ", phone: "0532 123 45 67" })).toEqual({
    name: "Ali Veli",
    businessName: "",
    phone: "0532 123 45 67",
    city: "",
    monthlyVehicles: "",
    notes: "Ana sayfa · Sizi arayalım",
  })
})

test("demo sayfası kaydı bugünkü gibi normalize edilir", () => {
  expect(normalizeDemoRequestBody({
    name: "Ali Veli", businessName: " Yıldız Oto ", phone: "0532", city: "İstanbul", monthlyVehicles: "50-100", notes: "  ",
  })).toEqual({
    name: "Ali Veli", businessName: "Yıldız Oto", phone: "0532", city: "İstanbul", monthlyVehicles: "50-100", notes: null,
  })
})

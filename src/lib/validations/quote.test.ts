import { expect, test } from "bun:test"
import { quoteItemSchema } from "@/lib/validations/quote"

// quoteItemSchema FORM değerlerini doğrular (TL/lira), kuruşa çevrim yalnız
// onSubmit'te (liraToKurus) yapılır. Katalogdan küsuratlı bir defaultPriceKurus
// (ör. 35050 kuruş -> kurusToLira -> 350.5 TL) forma yazılınca .int() kısıtı
// submit'i sessizce engelliyordu (bkz. task-11 code review bulgu 1).

const baseItem = { type: "labor" as const, name: "Yağ değişimi", quantity: 1 }

test("iki ondalıklı birim fiyat (350.5) kabul edilir", () => {
  const res = quoteItemSchema.safeParse({ ...baseItem, unitPrice: 350.5, totalPrice: 350.5 })
  expect(res.success).toBe(true)
})

test("tam sayı birim fiyat kabul edilir", () => {
  const res = quoteItemSchema.safeParse({ ...baseItem, unitPrice: 100, totalPrice: 100 })
  expect(res.success).toBe(true)
})

test("üç ondalıklı birim fiyat (350.555) reddedilir", () => {
  const res = quoteItemSchema.safeParse({ ...baseItem, unitPrice: 350.555, totalPrice: 350.555 })
  expect(res.success).toBe(false)
})

test("negatif birim fiyat reddedilir", () => {
  const res = quoteItemSchema.safeParse({ ...baseItem, unitPrice: -1, totalPrice: 100 })
  expect(res.success).toBe(false)
})

test("unitPrice null kabul edilir (fiyatsız kalem)", () => {
  const res = quoteItemSchema.safeParse({ ...baseItem, unitPrice: null, totalPrice: null })
  expect(res.success).toBe(true)
})

test("miktar hâlâ tam sayı olmak zorundadır", () => {
  const res = quoteItemSchema.safeParse({ ...baseItem, quantity: 1.5, unitPrice: 100, totalPrice: 100 })
  expect(res.success).toBe(false)
})

test("miktar en az 1 olmalıdır", () => {
  const res = quoteItemSchema.safeParse({ ...baseItem, quantity: 0, unitPrice: 100, totalPrice: 100 })
  expect(res.success).toBe(false)
})

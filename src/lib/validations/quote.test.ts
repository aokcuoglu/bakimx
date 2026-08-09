import { expect, test } from "bun:test"
import { quoteItemSchema } from "@/lib/validations/quote"
import { liraToKurus } from "@/lib/money"

// #179 — teklif formu artık iş emrinin kalem düzenleyicisini kullanıyor ve o
// düzenleyici parayı KURUŞ tamsayısı olarak taşıyor. Form ile sunucu aynı birimi
// konuştuğu için eski lira↔kuruş çevrim katmanı (ve onunla gelen yuvarlama
// tuzakları) kalktı: şema artık tamsayı kuruş bekler.

const baseItem = { type: "labor" as const, name: "Yağ değişimi", quantity: 1 }

test("tamsayı kuruş birim fiyat kabul edilir", () => {
  const res = quoteItemSchema.safeParse({ ...baseItem, unitPrice: 35050, totalPrice: 35050 })
  expect(res.success).toBe(true)
})

test("küsuratlı kuruş reddedilir — para tamsayı olmalı", () => {
  const res = quoteItemSchema.safeParse({ ...baseItem, unitPrice: 350.5, totalPrice: 350.5 })
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

// Eski akışta `qty * price` ham çarpımı kayan nokta artığı üretiyordu
// (64.07 × 9 = 576.6299999999999) ve şemadan geçemiyordu. Kuruş tabanında
// çarpım tamsayı olduğu için artık böyle bir artık üretilemiyor.
test("kuruş tabanında miktar × birim fiyat artık kayan nokta artığı üretmez", () => {
  const unitPrice = liraToKurus(64.07)
  expect(unitPrice).toBe(6407)
  const total = unitPrice * 9
  expect(Number.isInteger(total)).toBe(true)
  const res = quoteItemSchema.safeParse({ ...baseItem, quantity: 9, unitPrice, totalPrice: total })
  expect(res.success).toBe(true)
})

test("katalogdan gelen kuruş fiyatı doğrudan geçer (çevrim yok)", () => {
  // İşçilik kataloğu defaultPriceKurus'u kuruş saklıyor; forma olduğu gibi düşer.
  const res = quoteItemSchema.safeParse({ ...baseItem, unitPrice: 35050, totalPrice: null })
  expect(res.success).toBe(true)
})

test("sku ve birim opsiyoneldir, varsayılan birim 'adet'", () => {
  const res = quoteItemSchema.safeParse({ ...baseItem, unitPrice: null, totalPrice: null })
  expect(res.success).toBe(true)
  if (res.success) {
    expect(res.data.sku).toBeNull()
    expect(res.data.unit).toBe("adet")
  }
})

test("miktar hâlâ tam sayı olmak zorundadır", () => {
  const res = quoteItemSchema.safeParse({ ...baseItem, quantity: 1.5, unitPrice: 100, totalPrice: 100 })
  expect(res.success).toBe(false)
})

test("miktar en az 1 olmalıdır", () => {
  const res = quoteItemSchema.safeParse({ ...baseItem, quantity: 0, unitPrice: 100, totalPrice: 100 })
  expect(res.success).toBe(false)
})

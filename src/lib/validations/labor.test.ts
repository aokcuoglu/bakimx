import { expect, test } from "bun:test"
import { laborItemSchema } from "@/lib/validations/labor"

test("geçerli girdi kabul edilir", () => {
  const res = laborItemSchema.safeParse({ name: "Buji değişimi", defaultPriceKurus: 35000 })
  expect(res.success).toBe(true)
})

test("ad zorunludur", () => {
  const res = laborItemSchema.safeParse({ name: "   " })
  expect(res.success).toBe(false)
})

test("ad 120 karakteri aşamaz", () => {
  const res = laborItemSchema.safeParse({ name: "a".repeat(121) })
  expect(res.success).toBe(false)
})

test("kod 32 karakteri aşamaz", () => {
  const res = laborItemSchema.safeParse({ name: "Test", code: "a".repeat(33) })
  expect(res.success).toBe(false)
})

test("negatif fiyat reddedilir", () => {
  const res = laborItemSchema.safeParse({ name: "Test", defaultPriceKurus: -1 })
  expect(res.success).toBe(false)
})

test("ondalık kuruş reddedilir", () => {
  const res = laborItemSchema.safeParse({ name: "Test", defaultPriceKurus: 100.5 })
  expect(res.success).toBe(false)
})

test("ad baş/son boşluklardan arındırılır", () => {
  const res = laborItemSchema.parse({ name: "  Buji değişimi  " })
  expect(res.name).toBe("Buji değişimi")
})

test("isActive varsayılanı true", () => {
  const res = laborItemSchema.parse({ name: "Test" })
  expect(res.isActive).toBe(true)
})

import { expect, test } from "bun:test"
import { serviceOrderItemUpdateSchema } from "./order"

test("kısmi patch: sadece quantity geçerli", () => {
  const r = serviceOrderItemUpdateSchema.safeParse({ quantity: 3 })
  expect(r.success).toBe(true)
})

test("boş patch geçerlidir (hiçbir alan zorunlu değil)", () => {
  expect(serviceOrderItemUpdateSchema.safeParse({}).success).toBe(true)
})

test("quantity 0 reddedilir", () => {
  expect(serviceOrderItemUpdateSchema.safeParse({ quantity: 0 }).success).toBe(false)
})

test("negatif unitPrice reddedilir", () => {
  expect(serviceOrderItemUpdateSchema.safeParse({ unitPrice: -5 }).success).toBe(false)
})

test("brand/category/categoryId kabul edilir", () => {
  const r = serviceOrderItemUpdateSchema.safeParse({ brand: "BOSCH", category: "Yağ filtresi", categoryId: 100200 })
  expect(r.success).toBe(true)
})

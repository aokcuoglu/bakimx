import { expect, test } from "bun:test"
import { quickPartCreateSchema } from "./part"

test("kod ve ad kırpılır", () => {
  const parsed = quickPartCreateSchema.safeParse({ sku: "  BLK-1234 ", name: " Ön fren balatası " })
  expect(parsed.success).toBe(true)
  if (!parsed.success) return
  expect(parsed.data.sku).toBe("BLK-1234")
  expect(parsed.data.name).toBe("Ön fren balatası")
})

test("kod zorunludur", () => {
  const parsed = quickPartCreateSchema.safeParse({ sku: "   ", name: "Balata" })
  expect(parsed.success).toBe(false)
  if (parsed.success) return
  expect(parsed.error.issues[0]?.message).toBe("Stok kodu zorunludur")
})

test("ad zorunludur", () => {
  const parsed = quickPartCreateSchema.safeParse({ sku: "BLK-1", name: "" })
  expect(parsed.success).toBe(false)
  if (parsed.success) return
  expect(parsed.error.issues[0]?.message).toBe("Parça adı zorunludur")
})

test("marka ve kategori isteğe bağlıdır", () => {
  const parsed = quickPartCreateSchema.safeParse({ sku: "BLK-1", name: "Balata" })
  expect(parsed.success).toBe(true)
  if (!parsed.success) return
  expect(parsed.data.brand).toBeUndefined()
  expect(parsed.data.category).toBeUndefined()
  expect(parsed.data.salePrice).toBeUndefined()
})

test("satış fiyatı kuruş (tam sayı) olmalıdır — küsuratlı değer reddedilir", () => {
  // Modal TL alır, kuruşa çevirip gönderir; buraya küsurat gelirse şema yakalar.
  const parsed = quickPartCreateSchema.safeParse({ sku: "BLK-1", name: "Balata", salePrice: "1250.5" })
  expect(parsed.success).toBe(false)
})

test("satış fiyatı kuruş olarak kabul edilir", () => {
  const parsed = quickPartCreateSchema.safeParse({ sku: "BLK-1", name: "Balata", salePrice: "125050" })
  expect(parsed.success).toBe(true)
  if (!parsed.success) return
  expect(parsed.data.salePrice).toBe(125050)
})

test("negatif satış fiyatı reddedilir", () => {
  const parsed = quickPartCreateSchema.safeParse({ sku: "BLK-1", name: "Balata", salePrice: "-1" })
  expect(parsed.success).toBe(false)
})

test("60 karakterden uzun kod reddedilir", () => {
  const parsed = quickPartCreateSchema.safeParse({ sku: "A".repeat(61), name: "Balata" })
  expect(parsed.success).toBe(false)
  if (parsed.success) return
  expect(parsed.error.issues[0]?.message).toBe("Stok kodu en fazla 60 karakter olabilir")
})

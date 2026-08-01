import { expect, test } from "bun:test"
import { partSupplierPricesSchema, partCreateSchema } from "./part"

const base = { supplierId: "s1", purchasePrice: 1000, supplierSku: "", isPreferred: true }

test("boş liste geçerlidir", () => {
  expect(partSupplierPricesSchema.safeParse([]).success).toBe(true)
})

test("geçerli tek satır kabul edilir", () => {
  expect(partSupplierPricesSchema.safeParse([base]).success).toBe(true)
})

test("tedarikçisiz satır reddedilir", () => {
  const result = partSupplierPricesSchema.safeParse([{ ...base, supplierId: "" }])
  expect(result.success).toBe(false)
})

test("negatif fiyat reddedilir", () => {
  const result = partSupplierPricesSchema.safeParse([{ ...base, purchasePrice: -1 }])
  expect(result.success).toBe(false)
})

test("aynı tedarikçi iki kez eklenemez", () => {
  const result = partSupplierPricesSchema.safeParse([base, { ...base, isPreferred: false }])
  expect(result.success).toBe(false)
  expect(result.error?.issues[0]?.message).toBe("Aynı tedarikçi birden fazla eklenemez")
})

test("satır varken varsayılan seçilmemişse reddedilir", () => {
  const result = partSupplierPricesSchema.safeParse([{ ...base, isPreferred: false }])
  expect(result.success).toBe(false)
  expect(result.error?.issues[0]?.message).toBe("Bir varsayılan tedarikçi seçilmelidir")
})

test("birden fazla varsayılan reddedilir", () => {
  const result = partSupplierPricesSchema.safeParse([base, { ...base, supplierId: "s2" }])
  expect(result.success).toBe(false)
  expect(result.error?.issues[0]?.message).toBe("Bir varsayılan tedarikçi seçilmelidir")
})

test("parça kodu zorunludur", () => {
  const result = partCreateSchema.safeParse({ name: "Fren balatası", sku: "" })
  expect(result.success).toBe(false)
  expect(result.error?.issues[0]?.message).toBe("Parça kodu zorunludur")
})

test("parça kodu doluysa kabul edilir", () => {
  const result = partCreateSchema.safeParse({ name: "Fren balatası", sku: "0986424815" })
  expect(result.success).toBe(true)
})

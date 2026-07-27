import { test, expect } from "bun:test"
import { partsRequestSchema } from "./technician"

const base = { serviceOrderId: "ord_1", partName: "Yağ filtresi", quantity: "2" }

test("marka ve article id opsiyoneldir", () => {
  const r = partsRequestSchema.safeParse(base)
  expect(r.success).toBe(true)
})

test("katalog seçimi marka ve article id ile parse edilir", () => {
  const r = partsRequestSchema.safeParse({ ...base, brand: "MANN-FILTER", tecdocArticleId: "12345" })
  expect(r.success).toBe(true)
  if (r.success) {
    expect(r.data.brand).toBe("MANN-FILTER")
    expect(r.data.tecdocArticleId).toBe(12345)
  }
})

test("boş article id alanı yok sayılır (serbest metin talebi)", () => {
  const r = partsRequestSchema.safeParse({ ...base, brand: "", tecdocArticleId: "" })
  expect(r.success).toBe(true)
  if (r.success) expect(r.data.tecdocArticleId).toBeUndefined()
})

test("geçersiz article id reddedilir", () => {
  expect(partsRequestSchema.safeParse({ ...base, tecdocArticleId: "abc" }).success).toBe(false)
})

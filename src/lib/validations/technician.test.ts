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

// ── BAK-105: talep tipi ──────────────────────────────────────────────────────

test("tip gönderilmezse parça varsayılır (bugünkü davranış korunur)", () => {
  const r = partsRequestSchema.safeParse(base)
  expect(r.success).toBe(true)
  if (r.success) expect(r.data.type).toBe("part")
})

test("dış işçilikte katalog alanları temizlenir", () => {
  const r = partsRequestSchema.safeParse({
    ...base,
    type: "external_labor",
    partName: "Rot balans ayarı",
    partSku: "OEM-123",
    brand: "MANN-FILTER",
    tecdocArticleId: "12345",
  })
  expect(r.success).toBe(true)
  if (r.success) {
    expect(r.data.partSku).toBe("")
    expect(r.data.brand).toBe("")
    expect(r.data.tecdocArticleId).toBeUndefined()
  }
})

test("dış işçilikte miktar 1'e sabitlenir", () => {
  const r = partsRequestSchema.safeParse({ ...base, type: "external_labor", quantity: "7" })
  expect(r.success).toBe(true)
  if (r.success) expect(r.data.quantity).toBe(1)
})

test("dış işçilikte tahmini tutar TL metninden kuruşa çevrilir", () => {
  const r = partsRequestSchema.safeParse({
    ...base,
    type: "external_labor",
    supplierName: "  Ahmet Rot Balans  ",
    estimatedPrice: "1.250,50",
  })
  expect(r.success).toBe(true)
  if (r.success) {
    expect(r.data.estimatedPriceKurus).toBe(125050)
    expect(r.data.supplierName).toBe("Ahmet Rot Balans")
  }
})

test("boş/geçersiz tahmini tutar tutarsız talep üretmez", () => {
  for (const price of ["", "   ", "abc"]) {
    const r = partsRequestSchema.safeParse({ ...base, type: "external_labor", estimatedPrice: price })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.estimatedPriceKurus).toBeUndefined()
  }
})

test("parça talebine tutar/firma sızmaz", () => {
  const r = partsRequestSchema.safeParse({
    ...base,
    type: "part",
    supplierName: "Ahmet Rot Balans",
    estimatedPrice: "900",
  })
  expect(r.success).toBe(true)
  if (r.success) {
    expect(r.data.supplierName).toBe("")
    expect(r.data.estimatedPriceKurus).toBeUndefined()
  }
})

test("boş ad tipe göre farklı mesaj verir", () => {
  const part = partsRequestSchema.safeParse({ ...base, partName: "   " })
  expect(part.success).toBe(false)
  if (!part.success) expect(part.error.issues[0]?.message).toBe("Parça adı zorunludur")

  const labor = partsRequestSchema.safeParse({ ...base, type: "external_labor", partName: "" })
  expect(labor.success).toBe(false)
  if (!labor.success) expect(labor.error.issues[0]?.message).toBe("İşçilik adı zorunludur")
})

test("bilinmeyen tip reddedilir", () => {
  expect(partsRequestSchema.safeParse({ ...base, type: "labor" }).success).toBe(false)
})

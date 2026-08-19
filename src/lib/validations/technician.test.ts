import { test, expect } from "bun:test"
import {
  laborSessionEditSchema,
  laborSessionEditFormSchema,
  laborSessionNoteSchema,
  laborSessionRangeError,
  partsRequestSchema,
} from "./technician"

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

test("dış işçilikte miktar gönderilmezse (null/undefined) default 1 geçerli olur", () => {
  for (const quantity of [null, undefined]) {
    const r = partsRequestSchema.safeParse({ ...base, type: "external_labor", quantity })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.quantity).toBe(1)
  }
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

// ── BAK-138: işçilik süresi kaydı ────────────────────────────────────────────

const HOUR = 3_600_000

/** Sabit bir geçmiş an — testler "şimdi"ye göre kaymasın diye referans alınır. */
function agoISO(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}

test("geçerli aralık kabul edilir", () => {
  const r = laborSessionEditSchema.safeParse({
    startTime: agoISO(2 * HOUR),
    endTime: agoISO(HOUR),
    note: "Balata değişimi",
  })
  expect(r.success).toBe(true)
  if (r.success) expect(r.data.note).toBe("Balata değişimi")
})

test("bitiş başlangıçtan önce olamaz", () => {
  const r = laborSessionEditSchema.safeParse({ startTime: agoISO(HOUR), endTime: agoISO(2 * HOUR) })
  expect(r.success).toBe(false)
  if (!r.success) expect(r.error.issues[0]?.message).toBe("Bitiş saati başlangıçtan sonra olmalıdır")
})

test("bitiş başlangıca EŞİT olamaz (sıfır uzunluklu aralık)", () => {
  const same = agoISO(HOUR)
  const r = laborSessionEditSchema.safeParse({ startTime: same, endTime: same })
  expect(r.success).toBe(false)
  if (!r.success) expect(r.error.issues[0]?.path).toEqual(["endTime"])
})

test("gelecek saat reddedilir — süre ölçülür, planlanmaz", () => {
  const future = new Date(Date.now() + 2 * HOUR).toISOString()
  const r = laborSessionEditSchema.safeParse({ startTime: agoISO(HOUR), endTime: future })
  expect(r.success).toBe(false)
  if (!r.success) expect(r.error.issues[0]?.message).toBe("Bitiş saati gelecekte olamaz")
})

test("bir dakikalık pay 'şimdi'yi reddetmez (istemci/sunucu saat farkı)", () => {
  const r = laborSessionEditSchema.safeParse({
    startTime: agoISO(HOUR),
    endTime: new Date(Date.now() + 20_000).toISOString(),
  })
  expect(r.success).toBe(true)
})

test("aralık kuralları istemci ve sunucu şemasında AYNI kaynaktan gelir", () => {
  const start = new Date(Date.now() - 2 * HOUR)
  const end = new Date(Date.now() - 3 * HOUR)
  const shared = laborSessionRangeError(start, end)
  expect(shared).toEqual({ field: "end", message: "Bitiş saati başlangıçtan sonra olmalıdır" })

  // İstemci şeması yerel `datetime-local` metniyle çalışır ama aynı mesajı verir.
  const local = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  const r = laborSessionEditFormSchema.safeParse({ startLocal: local(start), endLocal: local(end), note: "" })
  expect(r.success).toBe(false)
  if (!r.success) {
    expect(r.error.issues[0]?.message).toBe("Bitiş saati başlangıçtan sonra olmalıdır")
    expect(r.error.issues[0]?.path).toEqual(["endLocal"])
  }
})

test("boş açıklama geçerlidir — sayacı durdurmak nota bağlı değil", () => {
  expect(laborSessionNoteSchema.safeParse({ note: "" }).success).toBe(true)
  expect(laborSessionNoteSchema.safeParse({}).success).toBe(true)
})

test("500 karakterden uzun açıklama reddedilir", () => {
  const r = laborSessionNoteSchema.safeParse({ note: "a".repeat(501) })
  expect(r.success).toBe(false)
})

test("geçersiz tarih metni reddedilir", () => {
  const r = laborSessionEditSchema.safeParse({ startTime: "dün", endTime: agoISO(HOUR) })
  expect(r.success).toBe(false)
})

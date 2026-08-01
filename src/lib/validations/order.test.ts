import { test, expect } from "bun:test"
import { orderInvoiceSchema } from "./order"

test("orderInvoiceSchema boş değerleri kabul eder (alan temizleme)", () => {
  const r = orderInvoiceSchema.safeParse({ invoiceNo: "", invoiceDate: "" })
  expect(r.success).toBe(true)
})

test("orderInvoiceSchema fatura numarasını kırpar", () => {
  const r = orderInvoiceSchema.safeParse({ invoiceNo: "  ABC-2026-001  ", invoiceDate: "" })
  expect(r.success).toBe(true)
  if (r.success) expect(r.data.invoiceNo).toBe("ABC-2026-001")
})

test("orderInvoiceSchema 50 karakteri aşan numarayı reddeder", () => {
  const r = orderInvoiceSchema.safeParse({ invoiceNo: "X".repeat(51), invoiceDate: "" })
  expect(r.success).toBe(false)
})

test("orderInvoiceSchema GG.AA.YYYY biçimini kabul eder", () => {
  const r = orderInvoiceSchema.safeParse({ invoiceNo: "", invoiceDate: "31.07.2026" })
  expect(r.success).toBe(true)
})

test("orderInvoiceSchema ISO ve serbest metin tarihi reddeder", () => {
  expect(orderInvoiceSchema.safeParse({ invoiceNo: "", invoiceDate: "2026-07-31" }).success).toBe(false)
  expect(orderInvoiceSchema.safeParse({ invoiceNo: "", invoiceDate: "dün" }).success).toBe(false)
})

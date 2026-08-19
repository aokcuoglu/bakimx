import { expect, test } from "bun:test"
import {
  INVOICE_EXPECTED_STATUSES,
  INVOICE_WITH,
  INVOICE_WITHOUT,
  isInvoiceExpected,
  isInvoiceMissing,
  resolveInvoiceFilter,
} from "@/lib/orders/invoice-filter"

test("boş değer filtre üretmez", () => {
  expect(resolveInvoiceFilter("")).toEqual({ value: "", where: {} })
  expect(resolveInvoiceFilter(null)).toEqual({ value: "", where: {} })
  expect(resolveInvoiceFilter(undefined)).toEqual({ value: "", where: {} })
  expect(resolveInvoiceFilter("   ")).toEqual({ value: "", where: {} })
})

test("tanınmayan değer filtresiz hâle düşer", () => {
  expect(resolveInvoiceFilter("hepsi")).toEqual({ value: "", where: {} })
  expect(resolveInvoiceFilter("WITH")).toEqual({ value: "", where: {} })
})

test("'with' fatura numarası dolu emirleri filtreler", () => {
  expect(resolveInvoiceFilter(INVOICE_WITH)).toEqual({
    value: "with",
    where: { AND: [{ invoiceNo: { not: null } }, { invoiceNo: { not: "" } }] },
  })
})

test("'without' null ve boş string'i birlikte yakalar", () => {
  expect(resolveInvoiceFilter(` ${INVOICE_WITHOUT} `)).toEqual({
    value: "without",
    where: { OR: [{ invoiceNo: null }, { invoiceNo: "" }] },
  })
})

test("fatura yalnız teslime hazır ve teslim edilmiş emirlerde beklenir", () => {
  expect(INVOICE_EXPECTED_STATUSES).toEqual(["ready_for_delivery", "delivered"])
  expect(isInvoiceExpected("ready_for_delivery")).toBe(true)
  expect(isInvoiceExpected("delivered")).toBe(true)
  for (const status of ["draft", "waiting_approval", "approved", "in_progress", "waiting_parts", "cancelled"]) {
    expect(isInvoiceExpected(status)).toBe(false)
  }
})

test("iptal edilmiş emirde fatura uyarısı basılmaz", () => {
  expect(isInvoiceMissing("cancelled", null)).toBe(false)
  expect(isInvoiceMissing("in_progress", null)).toBe(false)
})

test("fatura beklenen emirde boş numara uyarı üretir", () => {
  expect(isInvoiceMissing("delivered", null)).toBe(true)
  expect(isInvoiceMissing("delivered", "")).toBe(true)
  expect(isInvoiceMissing("delivered", "   ")).toBe(true)
  expect(isInvoiceMissing("ready_for_delivery", undefined)).toBe(true)
  expect(isInvoiceMissing("delivered", "FTR-2026-001")).toBe(false)
})

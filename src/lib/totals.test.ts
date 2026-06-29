import { expect, test } from "bun:test"
import { calculateOrderTotals } from "@/lib/totals"

// Money is integer kuruş; taxRate is bps (2000 = %20).

test("grandTotal computes tax exactly from kuruş line items", () => {
  const totals = calculateOrderTotals(
    [{ type: "labor", name: "x", quantity: 3, unitPrice: 3333, totalPrice: null }],
    { taxRate: 2000 }
  )
  expect(totals.subtotal).toBe(9999) // ₺99,99
  expect(totals.taxAmount).toBe(2000) // ₺20,00
  expect(totals.grandTotal).toBe(11999) // ₺119,99
})

test("discount is applied before tax", () => {
  const totals = calculateOrderTotals(
    [{ type: "part", name: "p", quantity: 1, unitPrice: null, totalPrice: 10000 }],
    { discountAmount: 1000, taxRate: 2000 }
  )
  expect(totals.subtotal).toBe(10000) // ₺100,00
  expect(totals.discountAmount).toBe(1000) // ₺10,00
  expect(totals.taxAmount).toBe(1800) // %20 of ₺90,00 = ₺18,00
  expect(totals.grandTotal).toBe(10800) // ₺108,00
})

test("parts and labor are grouped", () => {
  const totals = calculateOrderTotals([
    { type: "part", name: "p", quantity: 2, unitPrice: 5000, totalPrice: null },
    { type: "labor", name: "l", quantity: 1, unitPrice: null, totalPrice: 7500 },
  ])
  expect(totals.partsTotal).toBe(10000) // 2 * ₺50,00
  expect(totals.laborTotal).toBe(7500) // ₺75,00
  expect(totals.subtotal).toBe(17500)
  expect(totals.grandTotal).toBe(17500) // no tax/discount
})

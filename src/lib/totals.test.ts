import { expect, test } from "bun:test"
import { calculateOrderTotals } from "@/lib/totals"

test("grandTotal rounds to 2 decimals with tax", () => {
  const totals = calculateOrderTotals(
    [{ type: "labor", name: "x", quantity: 3, unitPrice: 33.33, totalPrice: null }],
    { taxRate: 20 }
  )
  expect(totals.subtotal).toBe(99.99)
  expect(totals.taxAmount).toBe(20)
  expect(totals.grandTotal).toBe(119.99)
})

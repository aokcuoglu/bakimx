import { describe, expect, test } from "bun:test"
import { calculateOrderTotalsFromMinimal } from "@/lib/totals"
import { computeStoredGrandTotal } from "./stored-total"

const item = (totalPrice: number | null, includeVat = true) => ({ totalPrice, unitPrice: totalPrice, quantity: 1, includeVat })

describe("computeStoredGrandTotal", () => {
  test("fiyatlı kalem yoksa null (listede —)", () => {
    expect(computeStoredGrandTotal([], {})).toBeNull()
    expect(computeStoredGrandTotal([item(null)], { discountAmount: 500, taxRate: 2000 })).toBeNull()
  })

  test("indirim ve KDV ile calculateOrderTotals sonucuyla aynı", () => {
    const items = [item(10000), item(5000, false)]
    const options = { discountAmount: 1500, taxRate: 2000 }
    expect(computeStoredGrandTotal(items, options)).toBe(calculateOrderTotalsFromMinimal(items, options).grandTotal)
  })

  test("KDV'siz, indirimsiz belgede kalem toplamı", () => {
    expect(computeStoredGrandTotal([item(10000), item(2500)], {})).toBe(12500)
  })

  test("0 TL kalem fiyatsız sayılır (listedeki — ile aynı karar)", () => {
    expect(computeStoredGrandTotal([item(0)], {})).toBeNull()
  })
})

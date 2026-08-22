import { expect, test } from "bun:test"
import { ORDER_ITEM_UNITS, quantityToNumber, validateQuantityForUnit } from "./quantity"

test("litre allows quantities with at most three decimal places", () => {
  expect(validateQuantityForUnit(1.2, "litre")).toBeNull()
  expect(validateQuantityForUnit(1.234, "litre")).toBeNull()
  expect(validateQuantityForUnit(1.2345, "litre")).not.toBeNull()
})

test("piece and stock-linked quantities remain integers", () => {
  expect(validateQuantityForUnit(2, "adet")).toBeNull()
  expect(validateQuantityForUnit(1.2, "adet")).not.toBeNull()
  expect(validateQuantityForUnit(1.2, "litre", true)).not.toBeNull()
})

test("automotive weight and length units allow decimals while packages remain integers", () => {
  expect(ORDER_ITEM_UNITS).toContain("kilogram")
  expect(ORDER_ITEM_UNITS).toContain("takim")
  expect(validateQuantityForUnit(0.25, "kilogram")).toBeNull()
  expect(validateQuantityForUnit(1.5, "metre")).toBeNull()
  expect(validateQuantityForUnit(1.5, "takim")).not.toBeNull()
  expect(validateQuantityForUnit(1.5, "kilogram", true)).not.toBeNull()
})

test("Prisma Decimal-like quantities normalize at DTO boundaries", () => {
  expect(quantityToNumber({ toNumber: () => 1.2 })).toBe(1.2)
})

import { expect, test } from "bun:test"
import { quantityToNumber, validateQuantityForUnit } from "./quantity"

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

test("Prisma Decimal-like quantities normalize at DTO boundaries", () => {
  expect(quantityToNumber({ toNumber: () => 1.2 })).toBe(1.2)
})

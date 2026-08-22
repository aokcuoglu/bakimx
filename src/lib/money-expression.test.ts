import { describe, expect, test } from "bun:test"
import { evaluateMoneyExpression } from "./money-expression"

describe("evaluateMoneyExpression", () => {
  test("operator precedence and calculator glyphs", () => {
    expect(evaluateMoneyExpression("2×100")).toBe(20_000)
    expect(evaluateMoneyExpression("100 + 25 * 2")).toBe(15_000)
    expect(evaluateMoneyExpression("(100 + 25) ÷ 2")).toBe(6_250)
  })

  test("Turkish decimal input is accepted and rounded to kuruş", () => {
    expect(evaluateMoneyExpression("1,20 * 3")).toBe(360)
    expect(evaluateMoneyExpression("10 / 3")).toBe(333)
    expect(evaluateMoneyExpression("₺1.234,56")).toBe(123_456)
  })

  test("invalid, unsafe and negative expressions are rejected", () => {
    for (const value of ["", "2**3", "2/0", "alert(1)", "1;2", "-1", "2+"]) {
      expect(evaluateMoneyExpression(value)).toBeNull()
    }
  })
})

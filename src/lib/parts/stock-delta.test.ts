import { expect, test } from "bun:test"
import { computeStockDelta } from "./stock-delta"

test("miktar artınca farkı rezerve eder", () => {
  expect(computeStockDelta(2, 5)).toEqual({ direction: "reserve", amount: 3 })
})

test("miktar azalınca farkı iade eder", () => {
  expect(computeStockDelta(5, 2)).toEqual({ direction: "return", amount: 3 })
})

test("miktar değişmezse hiçbir şey yapmaz", () => {
  expect(computeStockDelta(3, 3)).toEqual({ direction: "none", amount: 0 })
})

test("1'e düşürünce farkı iade eder", () => {
  expect(computeStockDelta(4, 1)).toEqual({ direction: "return", amount: 3 })
})

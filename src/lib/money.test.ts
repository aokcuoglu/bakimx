import { expect, test } from "bun:test"
import {
  roundMoney,
  sumMoney,
  addMoney,
  subMoney,
  moneyEquals,
  moneyGte,
} from "@/lib/money"

test("roundMoney fixes float drift to 2 decimals", () => {
  expect(roundMoney(0.1 + 0.2)).toBe(0.3)
  expect(roundMoney(10.004)).toBe(10)
  expect(roundMoney(10.006)).toBe(10.01)
})

test("sumMoney aggregates without drift", () => {
  expect(sumMoney([0.1, 0.2])).toBe(0.3)
  expect(sumMoney([100.1, 200.2, 300.3])).toBe(600.6)
  expect(sumMoney([])).toBe(0)
})

test("addMoney/subMoney round results", () => {
  expect(addMoney(0.1, 0.2)).toBe(0.3)
  expect(subMoney(0.3, 0.1)).toBe(0.2)
})

test("moneyEquals tolerates sub-cent drift", () => {
  expect(moneyEquals(0.1 + 0.2, 0.3)).toBe(true)
  expect(moneyEquals(100, 100.004)).toBe(true)
  expect(moneyEquals(100, 100.01)).toBe(false)
})

test("moneyGte tolerates sub-cent drift", () => {
  expect(moneyGte(100, 100)).toBe(true)
  expect(moneyGte(99.999, 100)).toBe(true)
  expect(moneyGte(99.9, 100)).toBe(false)
})

import { expect, test } from "bun:test"
import { computePaymentStatus, computeRemainingAmount } from "@/lib/cashbox/status"

// All amounts are integer kuruş.

test("exact payment reads as paid", () => {
  expect(computePaymentStatus(30, 30)).toBe("paid") // ₺0,30
  expect(computePaymentStatus(10000, 10000)).toBe("paid") // ₺100,00
})

test("underpayment is partial", () => {
  expect(computePaymentStatus(10000, 4000)).toBe("partial")
})

test("no payment is unpaid", () => {
  expect(computePaymentStatus(10000, 0)).toBe("unpaid")
})

test("over the total is overpaid", () => {
  expect(computePaymentStatus(10000, 10050)).toBe("overpaid")
})

test("remaining clamps and is exact", () => {
  expect(computeRemainingAmount(30, 30)).toBe(0)
  expect(computeRemainingAmount(10000, 4000)).toBe(6000)
  expect(computeRemainingAmount(10000, 15000)).toBe(0)
})

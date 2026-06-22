import { expect, test } from "bun:test"
import { computePaymentStatus, computeRemainingAmount } from "@/lib/cashbox/status"

test("exact payment reads as paid despite float drift", () => {
  expect(computePaymentStatus(0.3, 0.1 + 0.2)).toBe("paid")
  expect(computePaymentStatus(100, 100)).toBe("paid")
})

test("underpayment is partial", () => {
  expect(computePaymentStatus(100, 40)).toBe("partial")
})

test("no payment is unpaid", () => {
  expect(computePaymentStatus(100, 0)).toBe("unpaid")
})

test("over a cent is overpaid", () => {
  expect(computePaymentStatus(100, 100.5)).toBe("overpaid")
})

test("remaining clamps and rounds", () => {
  expect(computeRemainingAmount(0.3, 0.1 + 0.2)).toBe(0)
  expect(computeRemainingAmount(100, 40)).toBe(60)
  expect(computeRemainingAmount(100, 150)).toBe(0)
})

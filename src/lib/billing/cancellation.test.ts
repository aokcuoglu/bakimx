import { expect, test } from "bun:test"
import { canCancelPendingCardOrder } from "./cancellation"

const now = new Date("2026-09-27T12:00:00Z")
const old = new Date("2026-09-25T12:00:00Z")
const recent = new Date("2026-09-27T11:00:00Z")

test("card order without a payment attempt can be cancelled", () => {
  expect(canCancelPendingCardOrder([], now)).toBe(true)
})

test("live or completed payment attempt cannot be cancelled", () => {
  for (const status of ["initiated", "callback_received", "completed"]) {
    expect(canCancelPendingCardOrder([{ status, createdAt: old }], now)).toBe(false)
  }
})

test("failed attempts need a full 24 hour safety window", () => {
  expect(canCancelPendingCardOrder([{ status: "failed", createdAt: recent }], now)).toBe(false)
  expect(canCancelPendingCardOrder([{ status: "failed", createdAt: old }], now)).toBe(true)
  expect(canCancelPendingCardOrder([{ status: "expired", createdAt: old }, { status: "failed", createdAt: recent }], now)).toBe(false)
})

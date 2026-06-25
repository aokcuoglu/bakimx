import { test, expect } from "bun:test"
import { canTransitionIntake } from "./status-transitions"

test("delivered'a manuel geçiş reddedilir (yalnız OTP ile)", () => {
  expect(canTransitionIntake("ready_for_delivery", "delivered")).toBe(false)
})

test("approved'a manuel geçiş reddedilir (mevcut davranış korunur)", () => {
  expect(canTransitionIntake("waiting_approval", "approved")).toBe(false)
})

test("izinli geçiş hâlâ çalışır (in_progress → ready_for_delivery)", () => {
  expect(canTransitionIntake("in_progress", "ready_for_delivery")).toBe(true)
})

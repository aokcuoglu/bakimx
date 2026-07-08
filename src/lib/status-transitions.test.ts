import { test, expect } from "bun:test"
import { canTransitionIntake, isOrderLocked } from "./status-transitions"

test("delivered'a manuel geçiş reddedilir (yalnız OTP ile)", () => {
  expect(canTransitionIntake("ready_for_delivery", "delivered")).toBe(false)
})

test("approved'a manuel geçiş reddedilir (mevcut davranış korunur)", () => {
  expect(canTransitionIntake("waiting_approval", "approved")).toBe(false)
})

test("izinli geçiş hâlâ çalışır (in_progress → ready_for_delivery)", () => {
  expect(canTransitionIntake("in_progress", "ready_for_delivery")).toBe(true)
})

test("delivered ve cancelled kilitli sayılır", () => {
  expect(isOrderLocked("delivered")).toBe(true)
  expect(isOrderLocked("cancelled")).toBe(true)
})

test("aktif durumlar kilitli değildir", () => {
  expect(isOrderLocked("draft")).toBe(false)
  expect(isOrderLocked("in_progress")).toBe(false)
  expect(isOrderLocked("waiting_parts")).toBe(false)
  expect(isOrderLocked("ready_for_delivery")).toBe(false)
})

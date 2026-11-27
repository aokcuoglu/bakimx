import { expect, test } from "bun:test"
import { isIndefiniteAccess, resolveManualActivationPeriod } from "./manual-plan-activation"

const now = new Date("2026-11-27T10:00:00Z")

test("aylık seçim bir ay sonrasını yazar", () => {
  expect(resolveManualActivationPeriod({ cycle: "monthly", indefinite: false }, now)).toEqual({
    billingCycle: "monthly",
    currentPeriodEnd: new Date("2026-12-27T10:00:00Z"),
  })
})

test("yıllık seçim bir yıl sonrasını yazar", () => {
  expect(resolveManualActivationPeriod({ cycle: "yearly", indefinite: false }, now)).toEqual({
    billingCycle: "yearly",
    currentPeriodEnd: new Date("2027-11-27T10:00:00Z"),
  })
})

test("süresiz seçim ikisini de açıkça null yazar", () => {
  expect(resolveManualActivationPeriod({ indefinite: true }, now)).toEqual({ billingCycle: null, currentPeriodEnd: null })
})

test("dönemsiz ve süresizsiz girdi savunmacı olarak patlar", () => {
  expect(() => resolveManualActivationPeriod({ indefinite: false }, now)).toThrow()
})

test("isIndefiniteAccess: yalnız aktif ve bitişsiz ya da süresiz Lite", () => {
  expect(isIndefiniteAccess({ subscriptionStatus: "active", currentPeriodEnd: null })).toBe(true)
  expect(isIndefiniteAccess({ subscriptionStatus: "active" })).toBe(true)
  expect(isIndefiniteAccess({ subscriptionStatus: "active", currentPeriodEnd: "2026-12-01T00:00:00Z" })).toBe(false)
  expect(isIndefiniteAccess({ subscriptionStatus: "active", currentPeriodEnd: "2026-12-01T00:00:00Z", lifetimeLite: true })).toBe(true)
  expect(isIndefiniteAccess({ subscriptionStatus: "trialing", currentPeriodEnd: null })).toBe(false)
  expect(isIndefiniteAccess({ subscriptionStatus: "canceled", currentPeriodEnd: null })).toBe(false)
})

import { expect, test } from "bun:test"
import { addPeriod, periodStartFrom } from "@/lib/billing/period"

test("addPeriod adds one calendar month", () => {
  expect(addPeriod(new Date("2026-01-15T00:00:00Z"), "monthly").toISOString()).toBe(
    new Date("2026-02-15T00:00:00Z").toISOString()
  )
})

test("addPeriod adds one calendar year", () => {
  expect(addPeriod(new Date("2026-01-15T00:00:00Z"), "yearly").getUTCFullYear()).toBe(2027)
})

test("periodStartFrom extends from a future period end (early renewal)", () => {
  const now = new Date("2026-01-10T00:00:00Z")
  const end = new Date("2026-02-01T00:00:00Z")
  expect(periodStartFrom(end, now).toISOString()).toBe(end.toISOString())
})

test("periodStartFrom uses now when no/expired period", () => {
  const now = new Date("2026-03-10T00:00:00Z")
  expect(periodStartFrom(null, now).toISOString()).toBe(now.toISOString())
  expect(periodStartFrom(new Date("2026-01-01T00:00:00Z"), now).toISOString()).toBe(now.toISOString())
})

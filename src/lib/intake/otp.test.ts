import { test, expect } from "bun:test"
import { isOtpExpired } from "./otp"

const TTL = 10 * 60 * 1000

test("TTL içinde → dolmamış", () => {
  const created = new Date("2026-06-25T10:00:00Z")
  const now = new Date("2026-06-25T10:05:00Z") // 5 dk
  expect(isOtpExpired(created, now, TTL)).toBe(false)
})

test("TTL aşıldı → dolmuş", () => {
  const created = new Date("2026-06-25T10:00:00Z")
  const now = new Date("2026-06-25T10:11:00Z") // 11 dk
  expect(isOtpExpired(created, now, TTL)).toBe(true)
})

test("tam sınır (10dk) → dolmamış", () => {
  const created = new Date("2026-06-25T10:00:00Z")
  const now = new Date("2026-06-25T10:10:00Z")
  expect(isOtpExpired(created, now, TTL)).toBe(false)
})

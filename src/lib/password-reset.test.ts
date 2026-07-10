import { expect, test } from "bun:test"
import {
  generateResetToken,
  hashResetToken,
  resetExpiry,
  isResetExpired,
  RESET_TTL_MS,
} from "./password-reset"

test("RESET_TTL_MS is one hour", () => {
  expect(RESET_TTL_MS).toBe(60 * 60 * 1000)
})

test("generateResetToken returns a raw token and its matching sha256 hash", () => {
  const { token, tokenHash } = generateResetToken()
  expect(typeof token).toBe("string")
  expect(token.length).toBeGreaterThan(20)
  expect(tokenHash).toBe(hashResetToken(token))
  expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
})

test("hashResetToken is deterministic and never equals the raw token", () => {
  expect(hashResetToken("abc")).toBe(hashResetToken("abc"))
  expect(hashResetToken("abc")).not.toBe("abc")
})

test("two generated tokens differ", () => {
  const a = generateResetToken()
  const b = generateResetToken()
  expect(a.token).not.toBe(b.token)
  expect(a.tokenHash).not.toBe(b.tokenHash)
})

test("resetExpiry is RESET_TTL_MS after the given time", () => {
  const from = new Date("2026-01-01T00:00:00.000Z")
  expect(resetExpiry(from).getTime()).toBe(from.getTime() + RESET_TTL_MS)
})

test("isResetExpired: past is expired, future is not", () => {
  expect(isResetExpired(new Date(Date.now() - 1000))).toBe(true)
  expect(isResetExpired(new Date(Date.now() + 60_000))).toBe(false)
})

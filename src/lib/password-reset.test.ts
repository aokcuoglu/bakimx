import { expect, test } from "bun:test"
import {
  generateResetToken,
  hashResetToken,
  resetExpiry,
  isResetExpired,
  RESET_TTL_MS,
  RESET_RESEND_COOLDOWN_MS,
  resendCooldownRemainingMs,
  formatCooldownWait,
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

/** BAK-97 — konsoldan tekrar gönderim sınırı (saf karar, DB'siz test edilir). */

test("RESET_RESEND_COOLDOWN_MS is five minutes", () => {
  expect(RESET_RESEND_COOLDOWN_MS).toBe(5 * 60 * 1000)
})

test("hiç token yoksa bekleme yoktur", () => {
  expect(resendCooldownRemainingMs(null)).toBe(0)
  expect(resendCooldownRemainingMs(undefined)).toBe(0)
})

test("pencere içindeki token kalan süreyi döndürür", () => {
  const now = new Date("2026-08-18T12:00:00.000Z")
  const sentAt = new Date(now.getTime() - 60_000)
  expect(resendCooldownRemainingMs(sentAt, now)).toBe(RESET_RESEND_COOLDOWN_MS - 60_000)
})

test("pencere dolduğunda tekrar gönderilebilir", () => {
  const now = new Date("2026-08-18T12:00:00.000Z")
  const sentAt = new Date(now.getTime() - RESET_RESEND_COOLDOWN_MS)
  expect(resendCooldownRemainingMs(sentAt, now)).toBe(0)
  expect(resendCooldownRemainingMs(new Date(now.getTime() - RESET_RESEND_COOLDOWN_MS - 1), now)).toBe(0)
})

test("gelecek tarihli damga negatif süre üretmez", () => {
  const now = new Date("2026-08-18T12:00:00.000Z")
  expect(resendCooldownRemainingMs(new Date(now.getTime() + 10_000), now)).toBe(
    RESET_RESEND_COOLDOWN_MS + 10_000,
  )
})

test("bekleme metni saniye/dakika olarak yuvarlanır", () => {
  expect(formatCooldownWait(1_000)).toBe("1 saniye")
  expect(formatCooldownWait(45_500)).toBe("46 saniye")
  expect(formatCooldownWait(60_000)).toBe("1 dakika")
  expect(formatCooldownWait(61_000)).toBe("2 dakika")
  expect(formatCooldownWait(RESET_RESEND_COOLDOWN_MS)).toBe("5 dakika")
})

import { describe, expect, test } from "bun:test"
import {
  RESUME_TTL_MS,
  generateResumeToken,
  hashResumeToken,
  isResumeTokenUsable,
  isWellFormedResumeToken,
  resumeExpiry,
} from "./resume"

const NOW = new Date("2026-08-19T12:00:00.000Z")

describe("generateResumeToken", () => {
  test("ham token DB'de saklanan değerden farklıdır", () => {
    const { token, tokenHash } = generateResumeToken()
    expect(tokenHash).not.toBe(token)
    expect(tokenHash).toBe(hashResumeToken(token))
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })

  test("her çağrı yeni bir token üretir", () => {
    expect(generateResumeToken().token).not.toBe(generateResumeToken().token)
  })

  test("üretilen token URL'de taşınabilir biçimdedir", () => {
    const { token } = generateResumeToken()
    expect(isWellFormedResumeToken(token)).toBe(true)
    expect(encodeURIComponent(token)).toBe(token)
  })
})

describe("resumeExpiry", () => {
  test("bağlantı 7 gün geçerlidir", () => {
    expect(resumeExpiry(NOW).getTime() - NOW.getTime()).toBe(RESUME_TTL_MS)
    expect(RESUME_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000)
  })
})

describe("isWellFormedResumeToken", () => {
  test("boş/kısa/uzun değerler DB'ye kadar gitmez", () => {
    expect(isWellFormedResumeToken(null)).toBe(false)
    expect(isWellFormedResumeToken("")).toBe(false)
    expect(isWellFormedResumeToken("kisa")).toBe(false)
    expect(isWellFormedResumeToken("a".repeat(129))).toBe(false)
  })

  test("base64url dışı karakter reddedilir", () => {
    expect(isWellFormedResumeToken(`${"a".repeat(40)}/x`)).toBe(false)
    expect(isWellFormedResumeToken(`${"a".repeat(40)}%2F`)).toBe(false)
  })
})

describe("isResumeTokenUsable", () => {
  test("süresi dolmamış ve iptal edilmemiş token sohbeti açar", () => {
    expect(isResumeTokenUsable({ expiresAt: resumeExpiry(NOW), revokedAt: null }, NOW)).toBe(true)
  })

  test("süresi dolmuş token açmaz", () => {
    const expired = new Date(NOW.getTime() - 1)
    expect(isResumeTokenUsable({ expiresAt: expired, revokedAt: null }, NOW)).toBe(false)
  })

  test("iptal edilmiş token, süresi dolmamış olsa da açmaz", () => {
    expect(
      isResumeTokenUsable({ expiresAt: resumeExpiry(NOW), revokedAt: new Date(NOW) }, NOW),
    ).toBe(false)
  })
})

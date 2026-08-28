import { describe, expect, test } from "bun:test"
import {
  SALES_REGISTRATION_LINK_TTL_MS,
  buildSalesRegistrationPath,
  buildSalesRegistrationUrl,
  generateSalesRegistrationToken,
  hashSalesRegistrationToken,
  salesRegistrationLinkExpiry,
  salesRegistrationLinkState,
} from "@/lib/sales/registration-link"

describe("sales registration link", () => {
  test("7 günlük yüksek entropili token üretir ve yalnız hash'i saklanabilir", () => {
    const first = generateSalesRegistrationToken()
    const second = generateSalesRegistrationToken()
    expect(first.token).not.toBe(second.token)
    expect(first.tokenHash).toBe(hashSalesRegistrationToken(first.token))
    expect(first.tokenHash).not.toContain(first.token)
    expect(first.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(SALES_REGISTRATION_LINK_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000)
  })

  test("yol yalnız opak token taşır ve ham lead/danışman kimliği içermez", () => {
    const token = generateSalesRegistrationToken().token
    expect(buildSalesRegistrationPath(token)).toBe(`/register/sales/${token}`)
    expect(buildSalesRegistrationUrl("https://bakimx.com/", token)).toBe(
      `https://bakimx.com/register/sales/${token}`,
    )
  })

  test("durumda tüketim ve iptal, süre sonundan önce değerlendirilir", () => {
    const now = new Date("2026-08-27T12:00:00.000Z")
    expect(salesRegistrationLinkExpiry(now).toISOString()).toBe("2026-09-03T12:00:00.000Z")
    expect(salesRegistrationLinkState({ expiresAt: new Date("2026-08-28T12:00:00.000Z"), revokedAt: null, usedAt: null }, now)).toBe("active")
    expect(salesRegistrationLinkState({ expiresAt: now, revokedAt: null, usedAt: null }, now)).toBe("expired")
    expect(salesRegistrationLinkState({ expiresAt: new Date("2026-08-28T12:00:00.000Z"), revokedAt: now, usedAt: null }, now)).toBe("revoked")
    expect(salesRegistrationLinkState({ expiresAt: new Date("2026-08-26T12:00:00.000Z"), revokedAt: now, usedAt: now }, now)).toBe("used")
  })
})

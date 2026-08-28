import { describe, expect, test } from "bun:test"
import {
  SALES_ADVISOR_INVITE_TTL_MS,
  buildSalesAdvisorInviteUrl,
  generateSalesAdvisorInviteToken,
  hashSalesAdvisorInviteToken,
  isSalesAdvisorInviteExpired,
  salesAdvisorInviteExpiry,
} from "@/lib/sales/advisor-invite"

describe("sales advisor invite", () => {
  test("72 saatlik son kullanım zamanı üretir", () => {
    const from = new Date("2026-08-27T09:00:00.000Z")
    expect(SALES_ADVISOR_INVITE_TTL_MS).toBe(72 * 60 * 60 * 1000)
    expect(salesAdvisorInviteExpiry(from).toISOString()).toBe("2026-08-30T09:00:00.000Z")
  })

  test("sınır anında süresi dolmuş sayılır", () => {
    const expiresAt = new Date("2026-08-30T09:00:00.000Z")
    expect(isSalesAdvisorInviteExpired(expiresAt, new Date("2026-08-30T08:59:59.999Z"))).toBe(false)
    expect(isSalesAdvisorInviteExpired(expiresAt, new Date("2026-08-30T09:00:00.000Z"))).toBe(true)
  })

  test("URL ham kimlik değil yüksek entropili token taşır ve hash kararlıdır", () => {
    const first = generateSalesAdvisorInviteToken()
    const second = generateSalesAdvisorInviteToken()
    expect(first.token).not.toBe(second.token)
    expect(first.tokenHash).toBe(hashSalesAdvisorInviteToken(first.token))
    expect(first.tokenHash).not.toContain(first.token)
    expect(buildSalesAdvisorInviteUrl("https://bakimx.com/", first.token)).toBe(
      `https://bakimx.com/invite/sales/${first.token}`,
    )
  })
})

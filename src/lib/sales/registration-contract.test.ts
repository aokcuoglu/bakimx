import { describe, expect, it } from "bun:test"

const MIGRATION = await Bun.file(
  new URL("../../../prisma/migrations/20260827233000_sales_registration_links/migration.sql", import.meta.url),
).text()
const PUBLIC_REGISTER_PAGE = await Bun.file(
  new URL("../../app/(auth)/register/page.tsx", import.meta.url),
).text()
const REGISTER_FORM = await Bun.file(
  new URL("../../components/auth/register-form.tsx", import.meta.url),
).text()
const REGISTER_ROUTE = await Bun.file(
  new URL("../../app/api/auth/register/route.ts", import.meta.url),
).text()

describe("sales registration persistence and public-surface contract", () => {
  it("keeps one unconsumed and unrevoked link per lead at database level", () => {
    expect(MIGRATION).toContain("SalesRegistrationLink_one_active_per_lead")
    expect(MIGRATION).toContain('WHERE "usedAt" IS NULL AND "revokedAt" IS NULL')
    expect(MIGRATION).toContain('"tokenHash" TEXT NOT NULL')
    expect(MIGRATION).not.toContain('"token" TEXT')
  })

  it("does not publish an advisor directory or submit a raw advisor id from general registration", () => {
    expect(PUBLIC_REGISTER_PAGE).not.toContain("salesAdvisor.findMany")
    expect(REGISTER_FORM).not.toContain("acquisitionAdvisorId")
    expect(REGISTER_FORM).toContain("salesRegistrationToken")
  })

  it("rejects legacy raw advisor attribution at the public API boundary", () => {
    expect(REGISTER_ROUTE).toContain("typeof raw.acquisitionAdvisorId")
    expect(REGISTER_ROUTE).toContain("hashSalesRegistrationToken(data.salesRegistrationToken)")
  })
})

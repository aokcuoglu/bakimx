import { describe, expect, it } from "bun:test"

const schema = await Bun.file(new URL("../../../prisma/schema.prisma", import.meta.url)).text()
const migration = await Bun.file(new URL(
  "../../../prisma/migrations/20260828233000_sales_lead_google_places/migration.sql",
  import.meta.url,
)).text()
const actions = await Bun.file(new URL("../../app/admin/sales/actions.ts", import.meta.url)).text()

describe("sales lead Google location contract", () => {
  it("stores a durable Place identity and confirmed coordinate pair", () => {
    expect(schema).toContain("googlePlaceId       String?                 @unique")
    expect(schema).toContain("latitude            Decimal?                @db.Decimal(9, 6)")
    expect(schema).toContain("locationConfirmedAt DateTime?")
    expect(migration).toContain('CONSTRAINT "SalesLead_location_pair_check"')
    expect(migration).toContain('CONSTRAINT "SalesLead_location_confirmation_check"')
    expect(migration).toContain('CONSTRAINT "SalesLead_location_source_identity_check"')
  })

  it("prevents Google Place duplication without exposing another advisor's lead", () => {
    expect(actions).toContain("where: { googlePlaceId: data.googlePlaceId }")
    expect(actions).toContain('code: "place_conflict"')
    expect(actions).toContain('isUniqueConstraintError(error, "googlePlaceId")')
    expect(actions).toContain("başka bir danışmanın portföyünde")
    expect(actions).not.toContain("placeConflict.businessName")
  })
})

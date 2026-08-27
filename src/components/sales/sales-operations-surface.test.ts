import { describe, expect, it } from "bun:test"

const CONSOLE = await Bun.file(new URL("../../app/admin/sales/sales-console.tsx", import.meta.url)).text()
const PAGE = await Bun.file(new URL("../../app/admin/sales/page.tsx", import.meta.url)).text()

describe("sales operations surface contract", () => {
  it("keeps the territory map tied to accessible lead selection", () => {
    expect(CONSOLE).toContain("function SalesTerritoryMap")
    expect(CONSOLE).toContain("territoryPositionForCity")
    expect(CONSOLE).toContain("aria-pressed={lead.id === selectedLeadId}")
    expect(CONSOLE).toContain("onSelectLead(lead)")
  })

  it("explains both economic sources instead of presenting a generic coupon", () => {
    expect(CONSOLE).toContain("Danışman bütçeli")
    expect(CONSOLE).toContain("BakımX destekli")
    expect(CONSOLE).toContain("SALES_DISCOUNT_FUNDING_LABELS")
  })

  it("loads funding, creator and assignee attribution for every code row", () => {
    expect(PAGE).toContain("fundingSource: true")
    expect(PAGE).toContain("createdBy:")
    expect(PAGE).toContain("createdByName:")
  })
})

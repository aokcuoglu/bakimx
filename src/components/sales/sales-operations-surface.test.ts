import { describe, expect, it } from "bun:test"

const CONSOLE = await Bun.file(new URL("../../app/admin/sales/sales-console.tsx", import.meta.url)).text()
const PAGE = await Bun.file(new URL("../../app/admin/sales/page.tsx", import.meta.url)).text()
const TERRITORY_MAP = await Bun.file(new URL("./sales-territory-map.tsx", import.meta.url)).text()

describe("sales operations surface contract", () => {
  it("loads the browser-only Leaflet map without server-side rendering", () => {
    expect(CONSOLE).toContain('import("@/components/sales/sales-territory-map")')
    expect(CONSOLE).toContain("ssr: false")
    expect(TERRITORY_MAP).toContain("<MapContainer")
    expect(TERRITORY_MAP).toContain("<TileLayer")
    expect(TERRITORY_MAP).toContain("territoryCoordinatesForCity")
  })

  it("keeps map pins tied to accessible lead selection", () => {
    expect(TERRITORY_MAP).toContain('element.setAttribute("aria-label", label)')
    expect(TERRITORY_MAP).toContain('element.setAttribute("aria-pressed", String(selected))')
    expect(TERRITORY_MAP).toContain("keydown: (event)")
    expect(TERRITORY_MAP).toContain("onSelectLead(lead)")
  })

  it("keeps an attributed default map source and a tile failure state", () => {
    expect(TERRITORY_MAP).toContain("https://tile.openstreetmap.org/{z}/{x}/{y}.png")
    expect(TERRITORY_MAP).toContain("https://www.openstreetmap.org/copyright")
    expect(TERRITORY_MAP).toContain("tileerror: () => setTileFailed(true)")
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

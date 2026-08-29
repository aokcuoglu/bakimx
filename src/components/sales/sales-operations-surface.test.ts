import { describe, expect, it } from "bun:test"

const CONSOLE = await Bun.file(new URL("../../app/admin/sales/sales-console.tsx", import.meta.url)).text()
const PAGE = await Bun.file(new URL("../../app/admin/sales/page.tsx", import.meta.url)).text()
const TERRITORY_MAP = await Bun.file(new URL("./sales-territory-map.tsx", import.meta.url)).text()
const LOCATION_PICKER = await Bun.file(new URL("./sales-location-picker.tsx", import.meta.url)).text()

describe("sales operations surface contract", () => {
  it("loads the browser-only Google map without server-side rendering", () => {
    expect(CONSOLE).toContain('import("@/components/sales/sales-territory-map")')
    expect(CONSOLE).toContain("ssr: false")
    expect(TERRITORY_MAP).toContain('loadSalesGoogleLibrary(apiKey!, mapId!, "maps")')
    expect(TERRITORY_MAP).toContain("lead.latitude != null && lead.longitude != null")
    expect(TERRITORY_MAP).not.toContain("territoryCoordinatesForCity")
  })

  it("keeps map pins tied to accessible lead selection", () => {
    expect(TERRITORY_MAP).toContain('marker.setAttribute("aria-label"')
    expect(TERRITORY_MAP).toContain('marker.setAttribute("aria-pressed", String(selected))')
    expect(TERRITORY_MAP).toContain('gmpClickable: true')
    expect(TERRITORY_MAP).toContain("onSelectLeadRef.current(lead)")
  })

  it("discovers automotive places without bulk importing them", () => {
    expect(TERRITORY_MAP).toContain('"car_repair", "tire_shop", "car_dealer", "car_wash"')
    expect(TERRITORY_MAP).toContain("Place.searchNearby")
    expect(TERRITORY_MAP).toContain("Satış fırsatı oluştur")
    expect(TERRITORY_MAP).not.toContain("createSalesLead(")
  })

  it("keeps Google configuration failure isolated from the sales console", () => {
    expect(PAGE).toContain("GOOGLE_MAPS_BROWSER_API_KEY")
    expect(PAGE).toContain("GOOGLE_MAPS_MAP_ID")
    expect(TERRITORY_MAP).toContain("Harita kapalı olsa da satış portföyü çalışmaya devam eder")
  })

  it("requires a selected or manually pinned location to be confirmed", () => {
    expect(LOCATION_PICKER).toContain("AutocompleteSuggestion.fetchAutocompleteSuggestions")
    expect(LOCATION_PICKER).toContain('form.setValue("locationConfirmed", false')
    expect(LOCATION_PICKER).toContain("Bu konumu doğrula")
    expect(LOCATION_PICKER).toContain('gmpDraggable: true')
  })

  it("keeps the address hierarchy selection-based and tied to Google results", () => {
    expect(LOCATION_PICKER).toContain("<CitySelect")
    expect(LOCATION_PICKER).toContain("<DistrictSelect")
    expect(LOCATION_PICKER).toContain('["neighborhood", "sublocality", "administrative_area_level_4"]')
    expect(LOCATION_PICKER).toContain('["route"]')
    expect(LOCATION_PICKER).toContain("matchesSelectedTurkishArea")
    expect(LOCATION_PICKER).toContain('disabled={!configured || !city || !district || !neighborhood}')
    expect(CONSOLE).not.toContain('(["city", "district", "neighborhood", "route", "streetNumber", "postalCode"] as const).map')
  })

  it("keeps autocomplete place details inside the Essentials billing tier", () => {
    expect(LOCATION_PICKER).toContain(
      'fields: ["id", "formattedAddress", "addressComponents", "location", "viewport"]',
    )
    expect(LOCATION_PICKER).toContain("prediction.mainText?.toString()")
    expect(LOCATION_PICKER).not.toContain('"primaryType"')
    expect(LOCATION_PICKER).not.toContain("place.displayName")
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

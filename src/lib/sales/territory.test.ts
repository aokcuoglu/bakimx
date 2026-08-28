import { describe, expect, it } from "bun:test"
import { territoryCoordinatesForCity, TURKEY_CITY_COORDINATES } from "./territory"

describe("sales territory city coordinates", () => {
  it("matches Turkish casing and district suffixes", () => {
    expect(territoryCoordinatesForCity("İSTANBUL / Kadıköy")).toEqual(TURKEY_CITY_COORDINATES.İstanbul)
    expect(territoryCoordinatesForCity("izmir bornova")).toEqual(TURKEY_CITY_COORDINATES.İzmir)
  })

  it("normalizes circumflex variants", () => {
    expect(territoryCoordinatesForCity("Hakkari")).toEqual(TURKEY_CITY_COORDINATES.Hakkâri)
  })

  it("keeps unknown and missing cities off the map without inventing a location", () => {
    expect(territoryCoordinatesForCity("Berlin")).toBeNull()
    expect(territoryCoordinatesForCity(null)).toBeNull()
  })
})

import { describe, expect, it } from "bun:test"
import { territoryPositionForCity, TURKEY_CITY_POSITIONS } from "./territory"

describe("sales territory city projection", () => {
  it("matches Turkish casing and district suffixes", () => {
    expect(territoryPositionForCity("İSTANBUL / Kadıköy")).toEqual(TURKEY_CITY_POSITIONS.İstanbul)
    expect(territoryPositionForCity("izmir bornova")).toEqual(TURKEY_CITY_POSITIONS.İzmir)
  })

  it("normalizes circumflex variants", () => {
    expect(territoryPositionForCity("Hakkari")).toEqual(TURKEY_CITY_POSITIONS.Hakkâri)
  })

  it("keeps unknown and missing cities off the map without inventing a location", () => {
    expect(territoryPositionForCity("Berlin")).toBeNull()
    expect(territoryPositionForCity(null)).toBeNull()
  })
})

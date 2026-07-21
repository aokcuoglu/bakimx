import { describe, expect, it } from "bun:test"
import { searchQueryFor } from "./search"

describe("searchQueryFor", () => {
  it("plate mode: trims and returns the raw query", () => {
    expect(searchQueryFor("plate", "  34abc123 ")).toBe("34abc123")
  })
  it("plate mode: blank → null", () => {
    expect(searchQueryFor("plate", "   ")).toBeNull()
  })
  it("customer mode: always null (picker-level search off)", () => {
    expect(searchQueryFor("customer", "ahmet")).toBeNull()
  })
  it("vin mode: valid 17-char VIN → normalized (upper, no spaces)", () => {
    expect(searchQueryFor("vin", " wvwzzz1kz aw000001 ")).toBe("WVWZZZ1KZAW000001")
  })
  it("vin mode: partial VIN → null (no DB call)", () => {
    expect(searchQueryFor("vin", "WVWZZZ1KZ")).toBeNull()
  })
  it("vin mode: 17 chars with illegal O → null", () => {
    expect(searchQueryFor("vin", "WVWZZZ1KZAW0O0001")).toBeNull()
  })
})

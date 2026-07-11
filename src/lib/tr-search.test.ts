import { describe, expect, it } from "bun:test"
import { trIncludes } from "./tr-search"

describe("trIncludes", () => {
  it("dotted 'ais' matches 'AISIN' (Turkish dotless-I trap)", () => {
    // "AISIN".toLocaleLowerCase("tr") === "aısın" → tr-lower alone MISSES "ais";
    // the neutral-lowercase OR branch is what saves it.
    expect(trIncludes("AISIN", "ais")).toBe(true)
  })
  it("matches Turkish İ against 'i'", () => {
    expect(trIncludes("İÇTEN", "iç")).toBe(true)
  })
  it("plain case-insensitive contains still works", () => {
    expect(trIncludes("Fren balatası", "balat")).toBe(true)
    expect(trIncludes("7 SEVEN PARTS", "seven")).toBe(true)
  })
  it("non-match returns false", () => {
    expect(trIncludes("BOSCH", "mann")).toBe(false)
  })
  it("empty/whitespace query matches everything", () => {
    expect(trIncludes("BOSCH", "")).toBe(true)
    expect(trIncludes("BOSCH", "   ")).toBe(true)
  })
})

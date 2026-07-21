import { describe, expect, it } from "bun:test"
import { normalizePartSearchTerm, partSearchIncludes, trIncludes } from "./tr-search"

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

describe("normalizePartSearchTerm", () => {
  it("ayraçları (boşluk/tire/nokta) siler ve küçük harfe indirir", () => {
    expect(normalizePartSearchTerm("C 27 125")).toBe("c27125")
    expect(normalizePartSearchTerm("C-27-125")).toBe("c27125")
    expect(normalizePartSearchTerm("c27125")).toBe("c27125")
    expect(normalizePartSearchTerm("0 986 4B7 035")).toBe("09864b7035")
  })
  it("DB tarafı regexp_replace(lower(col),'[^a-z0-9]','','g') ile simetriktir", () => {
    // Aynı normalize server'da SQL, client'ta JS olarak koşar; eşleşme için birebir aynı olmalı.
    const sqlNorm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
    for (const v of ["C 27 125", "AZMT-41-040-1256", "Yağ filtresi", "0 986 4B7 035"]) {
      expect(normalizePartSearchTerm(v)).toBe(sqlNorm(v))
    }
  })
})

describe("partSearchIncludes", () => {
  it("boşluksuz yazınca boşluklu/tireli parça no'yu bulur (ekrandaki senaryo)", () => {
    expect(partSearchIncludes("C 27 125", "C27125")).toBe(true)
    expect(partSearchIncludes("C 27 125", "c 27 125")).toBe(true)
    expect(partSearchIncludes("AZMT-41-040-1256", "AZMT410401256")).toBe(true)
  })
  it("parça adı için de ayraç-duyarsız çalışır", () => {
    expect(partSearchIncludes("Hava filtresi", "havafiltresi")).toBe(true)
    expect(partSearchIncludes("Hava filtresi", "hava")).toBe(true)
  })
  it("boş needle her şeyle eşleşir, alakasız needle eşleşmez", () => {
    expect(partSearchIncludes("C 27 125", "")).toBe(true)
    expect(partSearchIncludes("C 27 125", "xyz")).toBe(false)
  })
})

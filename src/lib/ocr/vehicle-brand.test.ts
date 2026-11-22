import { describe, expect, test } from "bun:test"
import { brandKey, matchCatalogBrand } from "./vehicle-brand"

const CATALOG = ["Alfa Romeo", "BMW", "Citroen", "Fiat", "Ford", "Mercedes", "Renault", "Škoda", "Volkswagen"]

describe("brandKey", () => {
  test("büyük/küçük harf, aksan ve ayraçları yok sayar", () => {
    expect(brandKey("Mercedes-Benz")).toBe("mercedesbenz")
    expect(brandKey("CITROËN")).toBe("citroen")
    expect(brandKey("Škoda")).toBe("skoda")
    expect(brandKey("FİAT")).toBe("fiat")
  })
})

describe("matchCatalogBrand", () => {
  test("katalogdaki yazımı döndürür", () => {
    expect(matchCatalogBrand("RENAULT", CATALOG)).toBe("Renault")
    expect(matchCatalogBrand("citroën", CATALOG)).toBe("Citroen")
    expect(matchCatalogBrand("Skoda", CATALOG)).toBe("Škoda")
  })

  test("kısaltma ve uzun adları eşler", () => {
    expect(matchCatalogBrand("VW", CATALOG)).toBe("Volkswagen")
    expect(matchCatalogBrand("Mercedes-Benz", CATALOG)).toBe("Mercedes")
    expect(matchCatalogBrand("Alfa", CATALOG)).toBe("Alfa Romeo")
  })

  test("katalogda yoksa okunan ad kalır, boşsa null", () => {
    expect(matchCatalogBrand("Togg", CATALOG)).toBe("Togg")
    expect(matchCatalogBrand("  ", CATALOG)).toBeNull()
    expect(matchCatalogBrand("", [])).toBeNull()
  })

  test("çok kısa okuma ön ekle eşleşmez", () => {
    expect(matchCatalogBrand("Fo", CATALOG)).toBe("Fo")
  })
})

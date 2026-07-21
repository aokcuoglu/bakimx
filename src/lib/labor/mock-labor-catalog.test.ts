import { test, expect } from "bun:test"
import { getMockLaborCatalog, searchLaborCatalog } from "./mock-labor-catalog"

test("deterministic: catalog is stable and non-empty", () => {
  const a = getMockLaborCatalog()
  const b = getMockLaborCatalog()
  expect(a).toEqual(b)
  expect(a.length).toBeGreaterThanOrEqual(20)
})

test("every entry has valid shape (name, category, positive kuruş price)", () => {
  for (const e of getMockLaborCatalog()) {
    expect(e.id.length).toBeGreaterThan(0)
    expect(e.name.trim().length).toBeGreaterThan(0)
    expect(e.category.trim().length).toBeGreaterThan(0)
    expect(Number.isInteger(e.defaultPriceKurus)).toBe(true)
    expect(e.defaultPriceKurus).toBeGreaterThan(0)
  }
})

test("ids are unique", () => {
  const ids = getMockLaborCatalog().map((e) => e.id)
  expect(new Set(ids).size).toBe(ids.length)
})

test("search: empty query returns full catalog", () => {
  expect(searchLaborCatalog("").length).toBe(getMockLaborCatalog().length)
  expect(searchLaborCatalog("   ").length).toBe(getMockLaborCatalog().length)
})

test("search: matches by name, case- and accent-insensitive", () => {
  // "fren" should match "Fren" entries regardless of case
  const lower = searchLaborCatalog("fren")
  const upper = searchLaborCatalog("FREN")
  expect(lower.length).toBeGreaterThan(0)
  expect(lower).toEqual(upper)
  expect(lower.every((e) => `${e.name} ${e.category}`.toLocaleLowerCase("tr").includes("fren"))).toBe(true)
})

test("search: accent/İ folding — 'islem' matches 'İşlem'-like names", () => {
  // Turkish folding: query without diacritics should still match.
  const withDia = searchLaborCatalog("değişim")
  const withoutDia = searchLaborCatalog("degisim")
  expect(withoutDia.length).toBeGreaterThanOrEqual(withDia.length)
  expect(withoutDia.length).toBeGreaterThan(0)
})

test("search: matches by category", () => {
  const res = searchLaborCatalog("bakım")
  expect(res.some((e) => e.category.toLocaleLowerCase("tr").includes("bakım"))).toBe(true)
})

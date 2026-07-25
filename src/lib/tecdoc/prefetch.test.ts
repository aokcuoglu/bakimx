import { test, expect } from "bun:test"
import categoriesFixture from "./fixtures/categories-v2.json"
import { normalizeCategories } from "./normalize"
import { selectPrefetchTargets, eagerPrefetchTarget } from "./prefetch"

test("selectPrefetchTargets: bakım kategorilerini seçer (fren balatası 100030 dahil)", () => {
  const tree = normalizeCategories(categoriesFixture)
  const ids = selectPrefetchTargets(tree)
  // fixture'da kesin var olan bakım kategorileri seçilmeli
  expect(ids).toContain(100030) // Fren balatası
  expect(ids).toContain(100032) // Fren diski
  expect(ids).toContain(100259) // Yağ filtresi
  expect(ids).toContain(100260) // Hava filtresi
  expect(ids).toContain(100452) // Triger kayışı
  // makul üst sınır: yaygın set, tüm 422 yaprak değil
  expect(ids.length).toBeGreaterThan(10)
  expect(ids.length).toBeLessThan(120)
  // dedupe: benzersiz
  expect(new Set(ids).size).toBe(ids.length)
})

test("selectPrefetchTargets: boş ağaç → boş", () => {
  expect(selectPrefetchTargets([])).toEqual([])
})

test("eagerPrefetchTarget: katalog-bağlı + VIN teyitli → vehicleTypeId döner", () => {
  expect(eagerPrefetchTarget({ catalogVehicleTypeId: 12345, vinConfirmed: true })).toBe(12345)
})

test("eagerPrefetchTarget: VIN teyitsiz → null", () => {
  expect(eagerPrefetchTarget({ catalogVehicleTypeId: 12345, vinConfirmed: false })).toBeNull()
})

test("eagerPrefetchTarget: katalog bağlı değil → null", () => {
  expect(eagerPrefetchTarget({ catalogVehicleTypeId: null, vinConfirmed: true })).toBeNull()
})

test("eagerPrefetchTarget: eksik/undefined alanlar → null", () => {
  expect(eagerPrefetchTarget({})).toBeNull()
  expect(eagerPrefetchTarget({ catalogVehicleTypeId: 0, vinConfirmed: true })).toBeNull()
})

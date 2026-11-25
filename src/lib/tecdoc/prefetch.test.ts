import { test, expect } from "bun:test"
import categoriesFixture from "./fixtures/categories-v2.json"
import { normalizeCategories } from "./normalize"
import { selectPrefetchTargets, eagerPrefetchTarget, prefetchQuotaContext, prefetchCommonVehicleParts } from "./prefetch"

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

const proWorkshop = {
  id: "w1",
  planTier: "pro" as const,
  subscriptionStatus: "active" as const,
  approvalStatus: "approved" as const,
  trialEndsAt: null,
  currentPeriodEnd: null,
  extraVinQuota: 0,
  addons: [] as string[],
}

test("ön yükleme bağlamı yalnız partsCatalog yetkisi olan atölyeye verilir (#827)", () => {
  expect(prefetchQuotaContext({ ...proWorkshop, addons: ["vinLookup"] })).toBeNull()
  expect(prefetchQuotaContext({ ...proWorkshop, extraVinQuota: 5_000 })).toBeNull()
  expect(prefetchQuotaContext(proWorkshop)).toBeNull()
  expect(prefetchQuotaContext({ ...proWorkshop, addons: ["partsCatalog"] })).toMatchObject({
    workshopId: "w1",
    baseQuota: 15_000,
  })
  expect(prefetchQuotaContext({ ...proWorkshop, planTier: "premium" })).not.toBeNull()
})

test("yetkisiz atölyede ön yükleme sessizce çıkar, throw etmez (#827)", async () => {
  await expect(
    prefetchCommonVehicleParts(1234, { ...proWorkshop, addons: ["vinLookup"] }),
  ).resolves.toBeUndefined()
})

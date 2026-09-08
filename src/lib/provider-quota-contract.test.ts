import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()

test("VIN mock ve cache hit kota ayırmaz; gerçek miss sağlayıcıdan önce ayırır", () => {
  const source = readFileSync(join(root, "src/lib/vin/lookup.ts"), "utf8")
  const mockReturn = source.indexOf("provider.name === \"mock\"")
  const cacheReturn = source.indexOf("if (cachedRow)")
  const reservation = source.indexOf("await reserveWorkshopQuota(quotaContext, \"vin\")")
  const providerCall = source.indexOf("await provider.lookup(vin)", reservation)

  expect(mockReturn).toBeGreaterThan(-1)
  expect(cacheReturn).toBeGreaterThan(mockReturn)
  expect(reservation).toBeGreaterThan(cacheReturn)
  expect(providerCall).toBeGreaterThan(reservation)
})

test("TecDoc mock ve cache hit kota ayırmaz; gerçek miss sağlayıcıdan önce ayırır", () => {
  const source = readFileSync(join(root, "src/lib/tecdoc/catalog.ts"), "utf8")
  const mockReturn = source.indexOf("providerName === \"mock\"")
  const cacheRead = source.indexOf("if (cached)")
  const reservation = source.indexOf("await reserveWorkshopQuota(quotaContext, \"tecdoc\")")
  const providerCall = source.indexOf("await fetcher()", reservation)

  expect(mockReturn).toBeGreaterThan(-1)
  expect(cacheRead).toBeGreaterThan(mockReturn)
  expect(reservation).toBeGreaterThan(cacheRead)
  expect(providerCall).toBeGreaterThan(reservation)
})

test("otomatik prefetch aynı tenant kota bağlamını kategori ve makale misslerine taşır", () => {
  const source = readFileSync(join(root, "src/lib/tecdoc/prefetch.ts"), "utf8")
  expect(source).toContain("getVehicleCategories(vehicleTypeId, quotaContext)")
  expect(source).toContain("getArticlesByCategory(vehicleTypeId, categoryId, quotaContext)")
})

import { test, expect } from "bun:test"
import { TR_DISTRICTS, getDistricts } from "./tr-districts"
import { TR_CITIES } from "./tr-cities"

test("TR_DISTRICTS 81 ili kapsar ve anahtarlar TR_CITIES ile birebir eşleşir", () => {
  const keys = Object.keys(TR_DISTRICTS)
  expect(keys.length).toBe(81)
  const cities = new Set<string>(TR_CITIES)
  for (const k of keys) expect(cities.has(k)).toBe(true)
  for (const c of TR_CITIES) expect(TR_DISTRICTS[c]).toBeDefined()
})

test("her ilin en az bir ilçesi var, boş/yinelenen ilçe yok", () => {
  for (const districts of Object.values(TR_DISTRICTS)) {
    expect(Array.isArray(districts)).toBe(true)
    expect(districts.length).toBeGreaterThan(0)
    for (const d of districts) expect(d.trim().length).toBeGreaterThan(0)
    expect(new Set(districts).size).toBe(districts.length) // yinelenme yok
  }
})

test("bilinen il/ilçe eşleşmeleri (spot-check)", () => {
  expect(getDistricts("İstanbul")).toEqual(expect.arrayContaining(["Kadıköy", "Beykoz", "Üsküdar", "Şişli"]))
  expect(getDistricts("Ankara")).toEqual(expect.arrayContaining(["Çankaya", "Keçiören", "Yenimahalle"]))
  expect(getDistricts("İzmir")).toEqual(expect.arrayContaining(["Konak", "Bornova", "Karşıyaka"]))
  expect(getDistricts("Yalova")).toEqual(expect.arrayContaining(["Çınarcık", "Altınova"]))
})

test("getDistricts bilinmeyen il için boş dizi döner", () => {
  expect(getDistricts("Bilinmeyen")).toEqual([])
  expect(getDistricts("")).toEqual([])
})

test("her ilçe listesi Türkçe alfabetik sıralı", () => {
  const coll = new Intl.Collator("tr")
  for (const districts of Object.values(TR_DISTRICTS)) {
    const sorted = [...districts].sort((a, b) => coll.compare(a, b))
    expect(districts).toEqual(sorted)
  }
})

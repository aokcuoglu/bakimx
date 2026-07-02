import { test, expect } from "bun:test"
import {
  parseKw,
  parseCc,
  mapRuhsatFuel,
  parseRegYear,
  yearInRange,
  scoreCandidates,
  decideResolution,
  type CandidateTypeRow,
} from "./resolve"
import { extractMatchSections, isValidVin, normalizeVin } from "./types"

test("isValidVin: 17 chars, no I/O/Q, tolerates whitespace/lowercase", () => {
  expect(isValidVin("WF0MXXGCHMRT73173")).toBe(true)
  expect(isValidVin(" wf0mxxgchmrt73173 ")).toBe(true)
  expect(isValidVin("WF0MXXGCHMRT7317")).toBe(false) // 16 chars
  expect(isValidVin("WF0MXXGCHMRT7317O")).toBe(false) // letter O
  expect(isValidVin("")).toBe(false)
  expect(isValidVin(null)).toBe(false)
  expect(normalizeVin(" wf0 mxxgchmrt73173")).toBe("WF0MXXGCHMRT73173")
})

test("parseKw handles unit suffixes and decimals", () => {
  expect(parseKw("84 kW")).toBe(84)
  expect(parseKw("116")).toBe(116)
  expect(parseKw("84,5 KW")).toBe(85)
  expect(parseKw("")).toBeNull()
  expect(parseKw(null)).toBeNull()
})

test("parseCc handles units and thousands separators", () => {
  expect(parseCc("1499")).toBe(1499)
  expect(parseCc("1.499 cm3")).toBe(1499)
  expect(parseCc(null)).toBeNull()
})

test("mapRuhsatFuel maps ruhsat Turkish to TecDoc English", () => {
  expect(mapRuhsatFuel("DİZEL")).toBe("Diesel")
  expect(mapRuhsatFuel("dizel")).toBe("Diesel")
  expect(mapRuhsatFuel("MOTORİN")).toBe("Diesel")
  expect(mapRuhsatFuel("BENZİN")).toBe("Petrol")
  expect(mapRuhsatFuel("BENZİN-LPG")).toBe("Petrol")
  expect(mapRuhsatFuel("ELEKTRİK")).toBe("Electric")
  expect(mapRuhsatFuel("HİBRİT")).toBe("Hybrid")
  expect(mapRuhsatFuel("BİLİNMEYEN")).toBeNull()
  expect(mapRuhsatFuel(null)).toBeNull()
})

test("parseRegYear prefers modelYear, falls back to date string", () => {
  expect(parseRegYear("07.05.2025", 2024)).toBe(2024)
  expect(parseRegYear("07.05.2025", null)).toBe(2025)
  expect(parseRegYear(null, null)).toBeNull()
  expect(parseRegYear("garbage", 99999)).toBeNull()
})

test("yearInRange uses YYYY-MM catalog strings, open-ended yearTo", () => {
  expect(yearInRange(2024, "2018-11", null)).toBe(true)
  expect(yearInRange(2024, "2024-05", null)).toBe(true)
  expect(yearInRange(2017, "2018-11", null)).toBe(false)
  expect(yearInRange(2020, "2014-08", "2018-01")).toBe(false)
  expect(yearInRange(2020, null, null)).toBe(false) // no range info → no signal
})

// The real FOCUS IV case: ruhsat says 1499cc / 84 kW / DİZEL / model year 2024.
// DB row 158634 (1.5 EcoBlue, 1499cc, 85 kW, Diesel, 2024-05–) must win over
// the older 1.5 EcoBlue rows (70/88 kW) and the petrol variants.
const FOCUS_ROWS: CandidateTypeRow[] = [
  { id: 135550, name: "1.0 EcoBoost", cc: 999, fuelType: "Petrol", hp: 101, kwt: 74, yearFrom: "2018-11", yearTo: null, modelId: 39142, modelName: "FOCUS IV Saloon (HM)", brandId: 36, brandName: "FORD" },
  { id: 135552, name: "1.0 EcoBoost", cc: 999, fuelType: "Petrol", hp: 125, kwt: 92, yearFrom: "2018-11", yearTo: null, modelId: 39142, modelName: "FOCUS IV Saloon (HM)", brandId: 36, brandName: "FORD" },
  { id: 134069, name: "1.5 Ti-VCT", cc: 1496, fuelType: "Petrol", hp: 122, kwt: 90, yearFrom: "2018-11", yearTo: null, modelId: 39142, modelName: "FOCUS IV Saloon (HM)", brandId: 36, brandName: "FORD" },
  { id: 135557, name: "1.5 EcoBoost", cc: 1496, fuelType: "Petrol", hp: 150, kwt: 110, yearFrom: "2018-11", yearTo: null, modelId: 39142, modelName: "FOCUS IV Saloon (HM)", brandId: 36, brandName: "FORD" },
  { id: 135558, name: "1.5 EcoBlue", cc: 1499, fuelType: "Diesel", hp: 95, kwt: 70, yearFrom: "2018-11", yearTo: null, modelId: 39142, modelName: "FOCUS IV Saloon (HM)", brandId: 36, brandName: "FORD" },
  { id: 134068, name: "1.5 EcoBlue", cc: 1499, fuelType: "Diesel", hp: 120, kwt: 88, yearFrom: "2018-11", yearTo: null, modelId: 39142, modelName: "FOCUS IV Saloon (HM)", brandId: 36, brandName: "FORD" },
  { id: 158634, name: "1.5 EcoBlue", cc: 1499, fuelType: "Diesel", hp: 116, kwt: 85, yearFrom: "2024-05", yearTo: null, modelId: 39142, modelName: "FOCUS IV Saloon (HM)", brandId: 36, brandName: "FORD" },
]

test("scoreCandidates: real FOCUS ruhsat (84 kW vs DB 85 kW) picks 158634", () => {
  const ranked = scoreCandidates(FOCUS_ROWS, {
    engineDisplacement: "1499",
    enginePower: "84 kW",
    fuelType: "DİZEL",
    firstRegistrationDate: "07.05.2025",
    modelYear: 2024,
  })
  expect(ranked[0].vehicleTypeId).toBe(158634)
  // cc(+3) + kW ±3 (+3) + Diesel(+2) + 2024 in 2024-05–(+2) = 10
  expect(ranked[0].score).toBe(10)
  const decision = decideResolution(ranked)
  expect(decision.status).toBe("resolved")
  expect(decision.autoSelected).toBe(158634)
})

test("scoreCandidates: kW outside tolerance penalizes, hints absent are neutral", () => {
  const ranked = scoreCandidates(FOCUS_ROWS, { enginePower: "110 kW" })
  expect(ranked[0].vehicleTypeId).toBe(135557) // 1.5 EcoBoost 110 kW
  expect(ranked[0].score).toBe(3)
  expect(ranked.at(-1)!.score).toBe(-2)
})

test("decideResolution: no hints → ambiguous, single candidate → resolved", () => {
  const noHints = scoreCandidates(FOCUS_ROWS, {})
  expect(decideResolution(noHints).status).toBe("ambiguous")
  const single = scoreCandidates([FOCUS_ROWS[0]], {})
  expect(decideResolution(single)).toEqual({ status: "resolved", autoSelected: 135550 })
})

test("decideResolution: tie at top stays ambiguous even above threshold", () => {
  const twin = { ...FOCUS_ROWS[6], id: 999999 }
  const ranked = scoreCandidates([FOCUS_ROWS[6], twin], {
    engineDisplacement: "1499", enginePower: "84", fuelType: "DİZEL", modelYear: 2024,
  })
  expect(ranked[0].score).toBe(ranked[1].score)
  expect(decideResolution(ranked).status).toBe("ambiguous")
})

test("extractMatchSections unwraps {array:[...]} and nested envelopes", () => {
  const payload = {
    data: {
      matchingManufacturers: { array: [{ manuId: 36, manuName: "FORD" }] },
      matchingModels: { array: [{ manuId: 36, modelId: 39142, modelName: "FOCUS IV Saloon (HM)" }] },
      matchingVehicles: { array: [{ manuId: 36, modelId: 39142, vehicleId: 158634 }] },
    },
  }
  const sections = extractMatchSections(payload)
  expect(sections?.matchingVehicles).toHaveLength(1)
  expect(sections?.matchingVehicles[0].vehicleId).toBe(158634)

  // plain arrays also accepted
  const plain = extractMatchSections({ matchingVehicles: [{ manuId: 1, modelId: 2, vehicleId: 3 }] })
  expect(plain?.matchingVehicles[0].vehicleId).toBe(3)
  expect(plain?.matchingModels).toEqual([])

  expect(extractMatchSections({ some: "thing" })).toBeNull()
  expect(extractMatchSections(null)).toBeNull()
})

import { test, expect, afterEach } from "bun:test"
import { performVinResolve, VIN_RESOLVE_IDLE } from "./vin-resolve"
import type { VinCandidate } from "@/lib/vin/types"

const VIN = "SHSRD88604U201888"

function stubFetch(status: number, body: unknown) {
  global.fetch = (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
}

afterEach(() => {
  // @ts-expect-error test-only cleanup
  delete global.fetch
})

const CANDIDATE: VinCandidate = {
  vehicleTypeId: 16573, modelId: 4880, brandId: 45, brandName: "HONDA", modelName: "CR-V II (RD_)",
  label: "2.0 (RD5) • 110 kW / 150 HP • 2001-09–2007-03", name: "2.0 (RD5)",
  cc: 1998, kwt: 110, hp: 150, fuelType: "Petrol", yearFrom: "2001-09", yearTo: "2007-03", score: 0,
}

test("not_found response returns the notice and calls no callbacks", async () => {
  stubFetch(200, { status: "not_found", brand: null, model: null, autoSelected: null, candidates: [], cached: false })
  let called = false
  const state = await performVinResolve(VIN, {}, { onCandidate: () => { called = true } })
  expect(state.notice).toBe("VIN katalogda bulunamadı — marka ve modeli manuel seçin.")
  expect(called).toBe(false)
})

test("resolved with autoSelected calls onBrand/onModel/onCandidate and returns a recognized notice", async () => {
  stubFetch(200, {
    status: "resolved",
    brand: { id: 45, name: "HONDA" },
    model: { id: 4880, name: "CR-V II (RD_)" },
    autoSelected: 16573,
    candidates: [CANDIDATE],
    cached: false,
  })
  const calls: string[] = []
  const state = await performVinResolve(VIN, {}, {
    onBrand: (b) => calls.push(`brand:${b.name}`),
    onModel: (m) => calls.push(`model:${m.name}`),
    onCandidate: (c) => calls.push(`candidate:${c.vehicleTypeId}`),
  })
  expect(calls).toEqual(["brand:HONDA", "model:CR-V II (RD_)", "candidate:16573"])
  expect(state.notice).toBe("Araç katalogdan tanındı: HONDA CR-V II (RD_) 2.0 (RD5)")
  expect(state.candidates).toEqual([])
})

test("resolved without autoSelected (brand/model-only match) skips onCandidate", async () => {
  stubFetch(200, {
    status: "resolved",
    brand: { id: 45, name: "HONDA" },
    model: { id: 4880, name: "CR-V II (RD_)" },
    autoSelected: null,
    candidates: [],
    cached: false,
  })
  let candidateCalled = false
  const state = await performVinResolve(VIN, {}, { onCandidate: () => { candidateCalled = true } })
  expect(candidateCalled).toBe(false)
  expect(state.notice).toBe("Araç katalogdan tanındı: HONDA CR-V II (RD_)")
})

test("ambiguous response returns the candidate list, calls no onCandidate", async () => {
  const second = { ...CANDIDATE, vehicleTypeId: 99999, score: 0 }
  stubFetch(200, {
    status: "ambiguous",
    brand: { id: 45, name: "HONDA" },
    model: { id: 4880, name: "CR-V II (RD_)" },
    autoSelected: null,
    candidates: [CANDIDATE, second],
    cached: false,
  })
  let candidateCalled = false
  const state = await performVinResolve(VIN, {}, { onCandidate: () => { candidateCalled = true } })
  expect(candidateCalled).toBe(false)
  expect(state.candidates).toHaveLength(2)
  expect(state.notice).toBe("")
})

test("HTTP error response returns the server error message", async () => {
  stubFetch(429, { error: "Çok fazla VIN sorgusu yapıldı. Lütfen biraz bekleyip tekrar deneyin." })
  const state = await performVinResolve(VIN, {}, { onCandidate: () => {} })
  expect(state.error).toBe("Çok fazla VIN sorgusu yapıldı. Lütfen biraz bekleyip tekrar deneyin.")
})

test("network failure falls back to the generic retry message", async () => {
  global.fetch = (async () => { throw new Error("network down") }) as unknown as typeof fetch
  const state = await performVinResolve(VIN, {}, { onCandidate: () => {} })
  expect(state.error).toBe("VIN sorgulama sırasında bir hata oluştu. Lütfen tekrar deneyin.")
})

test("VIN_RESOLVE_IDLE is the zero state", () => {
  expect(VIN_RESOLVE_IDLE).toEqual({ loading: false, error: "", notice: "", candidates: [] })
})

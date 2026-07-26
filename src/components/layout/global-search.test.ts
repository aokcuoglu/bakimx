import { test, expect, afterEach } from "bun:test"
import { resultHref, fetchGlobalSearchResults } from "@/components/layout/global-search"
import type { UnifiedResult } from "@/lib/search/unified-results"

const VEHICLE: UnifiedResult = {
  kind: "vehicle",
  vehicleId: "veh-1",
  customerId: "cus-9",
  plate: "34MYL739",
  label: "34 MYL 739 — Renault Megane",
  sublabel: "Sahip: Ahmet Yılmaz",
}
const CUSTOMER: UnifiedResult = {
  kind: "customer",
  customerId: "cus-2",
  label: "Fatma Kaya",
  sublabel: "0532 000 00 00",
}

function stubFetch(status: number, body: unknown) {
  let captured = ""
  global.fetch = (async (url: string) => {
    captured = url
    return new Response(JSON.stringify(body), { status })
  }) as unknown as typeof fetch
  return () => captured
}

afterEach(() => {
  // @ts-expect-error test-only cleanup
  delete global.fetch
})

test("resultHref: araç → /vehicles/{vehicleId}", () => {
  expect(resultHref(VEHICLE)).toBe("/vehicles/veh-1")
})

test("resultHref: müşteri → /customers/{customerId}", () => {
  expect(resultHref(CUSTOMER)).toBe("/customers/cus-2")
})

test("fetchGlobalSearchResults: boş sorgu ağa çıkmadan [] döner", async () => {
  let called = false
  global.fetch = (async () => {
    called = true
    return new Response("{}", { status: 200 })
  }) as unknown as typeof fetch
  expect(await fetchGlobalSearchResults("   ")).toEqual([])
  expect(called).toBe(false)
})

test("fetchGlobalSearchResults: q'yu encode edip results dizisini döner", async () => {
  const getUrl = stubFetch(200, { results: [VEHICLE, CUSTOMER] })
  const out = await fetchGlobalSearchResults("34 myl")
  expect(out).toEqual([VEHICLE, CUSTOMER])
  expect(getUrl()).toBe("/api/search/customer-vehicle?q=34%20myl")
})

test("fetchGlobalSearchResults: res.ok değilse [] döner", async () => {
  stubFetch(500, { results: [VEHICLE] })
  expect(await fetchGlobalSearchResults("x")).toEqual([])
})

test("fetchGlobalSearchResults: results dizi değilse [] döner", async () => {
  stubFetch(200, { results: null })
  expect(await fetchGlobalSearchResults("x")).toEqual([])
})

test("fetchGlobalSearchResults: fetch fırlatırsa [] döner", async () => {
  global.fetch = (async () => {
    throw new Error("network")
  }) as unknown as typeof fetch
  expect(await fetchGlobalSearchResults("x")).toEqual([])
})

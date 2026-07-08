import { test, expect, afterEach } from "bun:test"
import { RapidApiVinProvider } from "./rapidapi-provider"

const VIN = "SHSRD88604U201888"

function stubFetch(status: number, body: unknown) {
  global.fetch = (async () =>
    new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
}

afterEach(() => {
  // @ts-expect-error test-only cleanup
  delete global.fetch
})

test("brand+model match but no vehicle-level match is still 'found' (not a terminal miss)", async () => {
  // Real TecDoc shape: manufacturer/model recognized, no exact engine-variant row.
  stubFetch(200, {
    data: {
      matchingManufacturers: { array: [{ manuId: 45, manuName: "HONDA" }] },
      matchingModels: { array: [{ manuId: 45, modelId: 4880, modelName: "CR-V II (RD_)" }] },
      matchingVehicles: { array: [] },
    },
    status: 200,
  })
  const result = await new RapidApiVinProvider("key").lookup(VIN)
  expect(result.status).toBe("found")
})

test("vehicle-level match is 'found'", async () => {
  stubFetch(200, {
    data: {
      matchingManufacturers: { array: [{ manuId: 45, manuName: "HONDA" }] },
      matchingModels: { array: [{ manuId: 45, modelId: 4880, modelName: "CR-V II (RD_)" }] },
      matchingVehicles: { array: [{ manuId: 45, modelId: 4880, vehicleId: 16573 }] },
    },
    status: 200,
  })
  const result = await new RapidApiVinProvider("key").lookup(VIN)
  expect(result.status).toBe("found")
})

test("no manufacturer/model/vehicle match at all is a genuine 'not_found'", async () => {
  stubFetch(200, {
    data: {
      matchingManufacturers: { array: [] },
      matchingModels: { array: [] },
      matchingVehicles: { array: [] },
    },
    status: 200,
  })
  const result = await new RapidApiVinProvider("key").lookup(VIN)
  expect(result.status).toBe("not_found")
})

test("HTTP 404 is 'not_found'", async () => {
  stubFetch(404, {})
  const result = await new RapidApiVinProvider("key").lookup(VIN)
  expect(result.status).toBe("not_found")
  expect(result.raw).toBeNull()
})

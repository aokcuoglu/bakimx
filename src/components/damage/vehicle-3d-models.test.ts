import { expect, test } from "bun:test"
import { readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { VEHICLE_ZONES } from "@/lib/constants"
import { BODY_TYPES, type BodyType } from "./vehicle-geometry"
import { VEHICLE_3D_MODELS, modelForBody } from "./vehicle-3d-models"

/** Reads the JSON chunk of a binary glTF without pulling three.js into the test runner. */
function glbJson(path: string): { nodes?: { name?: string; mesh?: number }[]; extensionsRequired?: string[] } {
  const buf = readFileSync(path)
  expect(buf.toString("ascii", 0, 4)).toBe("glTF")
  const length = buf.readUInt32LE(12)
  return JSON.parse(buf.toString("utf8", 20, 20 + length))
}

for (const [name, model] of Object.entries(VEHICLE_3D_MODELS)) {
  const file = join(process.cwd(), "public", model.url)

  test(`${name} model exposes every damage zone as its own node`, () => {
    const meshNodes = (glbJson(file).nodes ?? []).filter((n) => n.mesh !== undefined).map((n) => n.name)
    expect(meshNodes.filter((n) => n !== "trim").sort()).toEqual(Object.keys(VEHICLE_ZONES).sort())
  })

  test(`${name} model stays light enough for a phone on a workshop connection`, () => {
    expect(statSync(file).size).toBeLessThan(1.5 * 1024 * 1024)
    // The viewer decodes meshopt in-bundle; Draco would need a decoder fetched from a CDN.
    expect(glbJson(file).extensionsRequired ?? []).not.toContain("KHR_draco_mesh_compression")
  })

  test(`${name} model keeps its CC BY credit`, () => {
    expect(model.credit.author).toBeTruthy()
    expect(model.credit.source).toStartWith("https://")
    expect(model.credit.licenseUrl).toContain("creativecommons.org/licenses/by/")
  })
}

test("every supported body type maps to a 3D model; unsupported falls back to the zone list", () => {
  for (const body of Object.keys(BODY_TYPES) as BodyType[]) {
    if (body === "unsupported") expect(modelForBody(body)).toBeNull()
    else expect(modelForBody(body)! in VEHICLE_3D_MODELS).toBe(true)
  }
})

import { expect, test } from "bun:test"
import { getVehicleGeometry, VEHICLE_VIEWBOX } from "./vehicle-geometry"
import { VEHICLE_ZONES } from "@/lib/constants"

const BODIES = ["sedan", "suv", "van"] as const
const [, , WIDTH, HEIGHT] = VEHICLE_VIEWBOX.split(" ").map(Number)

test("every exploded body diagram covers each existing zone exactly once", () => {
  for (const body of BODIES) {
    const { panels } = getVehicleGeometry(body)
    expect(panels.map(p => p.id).sort()).toEqual(Object.keys(VEHICLE_ZONES).sort())
    for (const p of panels) {
      expect(p.path).not.toContain("NaN")
      expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(WIDTH)
      expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(HEIGHT)
    }
  }
})

test("left zones sit on the viewer's left because the front points up", () => {
  for (const body of BODIES) {
    const at = (id: string) => getVehicleGeometry(body).panels.find(p => p.id === id)!
    for (const part of ["front_fender", "front_door", "rear_door", "rear_fender", "headlight", "taillight"]) {
      expect(at(`left_${part}`).x).toBeLessThan(WIDTH / 2)
      expect(at(`right_${part}`).x).toBeGreaterThan(WIDTH / 2)
    }
    expect(at("front_bumper").y).toBeLessThan(at("hood").y)
    expect(at("hood").y).toBeLessThan(at("roof").y)
    expect(at("roof").y).toBeLessThan(at("trunk").y)
    expect(at("trunk").y).toBeLessThan(at("rear_bumper").y)
  }
})

test("body types have distinct proportions", () => {
  const hood = (body: (typeof BODIES)[number]) => getVehicleGeometry(body).panels.find(p => p.id === "hood")!.path
  expect(new Set(BODIES.map(hood)).size).toBe(BODIES.length)
})

test("unsupported body does not invent a diagram", () => expect(getVehicleGeometry("unsupported").panels).toEqual([]))

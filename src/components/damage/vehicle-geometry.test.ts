import { expect, test } from "bun:test"
import { getVehicleGeometry, VEHICLE_VIEWS, type VehicleView } from "./vehicle-geometry"
import { VEHICLE_ZONES } from "@/lib/constants"

test("all original body diagrams cover every existing zone across five views", () => {
  for (const body of ["sedan", "suv", "van"] as const) {
    const all = new Set<string>()
    for (const view of Object.keys(VEHICLE_VIEWS) as VehicleView[]) {
      const {panels} = getVehicleGeometry(body,view)
      expect(panels.length).toBeGreaterThan(5)
      expect(new Set(panels.map(p=>p.id)).size).toBe(panels.length)
      panels.forEach(p=> {expect(p.id in VEHICLE_ZONES).toBe(true);expect(p.path).not.toContain("NaN");all.add(p.id)})
    }
    expect([...all].sort()).toEqual(Object.keys(VEHICLE_ZONES).sort())
  }
})
test("front-facing drawing correctly reverses driver-side lights", () => {
  const front=getVehicleGeometry("sedan","front").panels
  expect(front.find(p=>p.id==="left_headlight")!.x).toBeGreaterThan(front.find(p=>p.id==="right_headlight")!.x)
  const rear=getVehicleGeometry("sedan","rear").panels
  expect(rear.find(p=>p.id==="left_taillight")!.x).toBeLessThan(rear.find(p=>p.id==="right_taillight")!.x)
})
test("unsupported body does not invent a diagram",()=>expect(getVehicleGeometry("unsupported","top").panels).toEqual([]))

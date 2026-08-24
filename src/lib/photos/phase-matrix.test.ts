import { describe, expect, test } from "bun:test"
import {
  buildPhotoPhaseMatrix,
  countFilledPhases,
  flattenTypeAcrossPhases,
  isDamagePhotoType,
  isVehiclePhotoType,
  partitionIntakePhotos,
  phaseCoverSlides,
} from "./phase-matrix"

describe("partitionIntakePhotos", () => {
  test("splits damage_detail from vehicle angles", () => {
    const photos = [
      { id: "1", type: "front" },
      { id: "2", type: "damage_detail" },
      { id: "3", type: "rear" },
      { id: "4", type: "damage_detail" },
    ]
    const { vehicle, damage } = partitionIntakePhotos(photos)
    expect(vehicle.map((p) => p.id)).toEqual(["1", "3"])
    expect(damage.map((p) => p.id)).toEqual(["2", "4"])
  })
})

describe("type guards", () => {
  test("damage vs vehicle", () => {
    expect(isDamagePhotoType("damage_detail")).toBe(true)
    expect(isDamagePhotoType("front")).toBe(false)
    expect(isVehiclePhotoType("front")).toBe(true)
    expect(isVehiclePhotoType("damage_detail")).toBe(false)
  })
})

describe("buildPhotoPhaseMatrix", () => {
  test("always includes required rows; optional only when present", () => {
    const rows = buildPhotoPhaseMatrix([
      { id: "a", type: "front", phase: "intake", fileUrl: "/a" },
      { id: "b", type: "front", phase: "delivery", fileUrl: "/b" },
      { id: "c", type: "other", phase: "intake", fileUrl: "/c" },
      { id: "d", type: "damage_detail", phase: "intake", fileUrl: "/d" },
    ])

    expect(rows.find((r) => r.type === "damage_detail")).toBeUndefined()
    expect(rows.find((r) => r.type === "front")?.cells.map((c) => c.photos.map((p) => p.id))).toEqual([
      ["a"],
      [],
      ["b"],
    ])
    expect(rows.find((r) => r.type === "rear")?.required).toBe(true)
    expect(rows.find((r) => r.type === "rear")?.cells.every((c) => c.photos.length === 0)).toBe(true)
    expect(rows.find((r) => r.type === "other")?.cells[0].photos.map((p) => p.id)).toEqual(["c"])
    expect(rows.find((r) => r.type === "vin_area")).toBeUndefined()
  })

  test("unknown phase falls back to intake", () => {
    const rows = buildPhotoPhaseMatrix([
      { id: "x", type: "front", phase: "weird", fileUrl: null },
    ])
    const front = rows.find((r) => r.type === "front")!
    expect(front.cells[0].photos.map((p) => p.id)).toEqual(["x"])
    expect(front.cells[1].photos).toHaveLength(0)
  })

  test("flattenTypeAcrossPhases follows Kabul → Onarım → Teslim", () => {
    const rows = buildPhotoPhaseMatrix([
      { id: "d", type: "front", phase: "delivery", fileUrl: null },
      { id: "i", type: "front", phase: "intake", fileUrl: null },
      { id: "r", type: "front", phase: "repair_progress", fileUrl: null },
    ])
    const flat = flattenTypeAcrossPhases(rows.find((r) => r.type === "front")!)
    expect(flat.map((p) => p.id)).toEqual(["i", "r", "d"])
  })

  test("phaseCoverSlides uses one cover per phase, not every intake duplicate", () => {
    const rows = buildPhotoPhaseMatrix([
      { id: "i1", type: "front", phase: "intake", fileUrl: "/a" },
      { id: "i2", type: "front", phase: "intake", fileUrl: "/b" },
      { id: "i3", type: "front", phase: "intake", fileUrl: "/c" },
      { id: "r1", type: "front", phase: "repair_progress", fileUrl: "/d" },
    ])
    const front = rows.find((r) => r.type === "front")!
    const covers = phaseCoverSlides(front)
    expect(covers.map((c) => c.phase)).toEqual(["intake", "repair_progress"])
    expect(covers.map((c) => c.photo.id)).toEqual(["i1", "r1"])
    expect(countFilledPhases(front)).toBe(2)
  })
})

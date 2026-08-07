import { test, expect } from "bun:test"
import { buildPhotoFormData, missingRequiredPhotoTypes, suggestPhotoPhase } from "./photo-upload"

test("devam eden iş emrinde varsayılan aşama onarım", () => {
  expect(suggestPhotoPhase("in_progress")).toBe("repair_progress")
  expect(suggestPhotoPhase("waiting_parts")).toBe("repair_progress")
})

test("iş bittikten sonra varsayılan aşama teslim", () => {
  expect(suggestPhotoPhase("completed")).toBe("delivery")
  expect(suggestPhotoPhase("delivered")).toBe("delivery")
})

test("iş başlamadan önce varsayılan aşama kabul", () => {
  expect(suggestPhotoPhase("draft")).toBe("intake")
  expect(suggestPhotoPhase("waiting_approval")).toBe("intake")
  expect(suggestPhotoPhase("bilinmeyen")).toBe("intake")
})

test("eksik zorunlu türler yalnızca çekilmemişleri listeler", () => {
  expect(missingRequiredPhotoTypes([])).toEqual([
    "front", "rear", "left_side", "right_side", "dashboard_mileage", "fuel_gauge",
  ])
  expect(missingRequiredPhotoTypes(["front", "rear", "left_side", "right_side"])).toEqual([
    "dashboard_mileage", "fuel_gauge",
  ])
})

test("opsiyonel türler eksik listesine girmez", () => {
  const missing = missingRequiredPhotoTypes([])
  expect(missing).not.toContain("damage_detail")
  expect(missing).not.toContain("other")
})

test("etiket istemciden değil katalogdan türetilir", () => {
  const fd = buildPhotoFormData({ intakeFormId: "if1", type: "dashboard_mileage", phase: "repair_progress" })
  expect(fd.get("intakeFormId")).toBe("if1")
  expect(fd.get("type")).toBe("dashboard_mileage")
  expect(fd.get("label")).toBe("Kilometre")
  expect(fd.get("phase")).toBe("repair_progress")
})

test("bilinmeyen tür için etiket türün kendisine düşer", () => {
  const fd = buildPhotoFormData({ intakeFormId: "if1", type: "bilinmeyen", phase: "intake" })
  expect(fd.get("label")).toBe("bilinmeyen")
})

test("boş not gönderilmez, dolu not kırpılır", () => {
  const empty = buildPhotoFormData({ intakeFormId: "if1", type: "other", phase: "intake", note: "   " })
  expect(empty.get("note")).toBeNull()

  const filled = buildPhotoFormData({ intakeFormId: "if1", type: "other", phase: "intake", note: "  sol far  " })
  expect(filled.get("note")).toBe("sol far")
})

test("dosya seçilmediğinde file alanı boş kalır", () => {
  const fd = buildPhotoFormData({ intakeFormId: "if1", type: "other", phase: "intake", file: null })
  expect(fd.get("file")).toBeNull()
})

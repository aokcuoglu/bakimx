import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const WORK_ORDER_DETAIL = readFileSync(
  join(import.meta.dir, "../../components/orders/work-order-detail.tsx"),
  "utf8",
)
const INTAKE_ACTIONS = readFileSync(
  join(import.meta.dir, "../../app/(app)/intakes/actions.ts"),
  "utf8",
)

test("Lite iş emrinde fotoğraf ekleme diyaloğu render edilmez", () => {
  expect(WORK_ORDER_DETAIL).toContain("{!orderLocked && canUsePhotoChecklist && (<>")
  expect(WORK_ORDER_DETAIL).not.toContain('if (!canUsePhotoChecklist) {\n                  setPhotoType("other")')
})

test("Lite fotoğraf kısayolu diyaloğu açmak yerine yükseltme alanına gider", () => {
  const focusPhoto = WORK_ORDER_DETAIL.match(
    /function focusPhoto\([\s\S]*?\n  }\n\n  return \(/,
  )?.[0]

  expect(focusPhoto).toBeDefined()
  expect(focusPhoto).toContain("if (!canUsePhotoChecklist)")
  expect(focusPhoto).toContain('handleTabChange("kanit")')
  expect(focusPhoto).toMatch(/if \(!canUsePhotoChecklist\)[\s\S]*?return[\s\S]*?setAddingPhoto\(true\)/)
})

test("sunucu temel other/intake fotoğraf ekleme istisnası bırakmaz", () => {
  const addPhotoAction = INTAKE_ACTIONS.match(
    /export async function addPhotoAction[\s\S]*?export async function replacePhotoAction/,
  )?.[0]

  expect(addPhotoAction).toBeDefined()
  expect(addPhotoAction).toContain('if (type === "damage_detail")')
  expect(addPhotoAction).toContain('assertFeature(workshop, "damageMap")')
  expect(addPhotoAction).toContain('assertFeature(workshop, "photoChecklist")')
  expect(addPhotoAction).not.toContain('type !== "other"')
  expect(addPhotoAction).not.toContain('phase !== "intake"')
})

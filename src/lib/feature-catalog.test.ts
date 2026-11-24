import { expect, test } from "bun:test"
import { FEATURE_CATALOG } from "@/lib/feature-catalog"
import { GATED_FEATURES, isAddonFeature } from "@/lib/plan"

test("özellik kataloğunun türü plan kapısıyla aynı: ek özellik ↔ ADDON_FEATURES (#782)", () => {
  for (const feature of GATED_FEATURES) {
    expect(FEATURE_CATALOG[feature].kind).toBe(isAddonFeature(feature) ? "addon" : "package")
  }
})

test("kilit metinleri satıştan kalkan paket adlarını anmaz", () => {
  for (const feature of GATED_FEATURES) {
    const { title, description, benefits } = FEATURE_CATALOG[feature]
    const copy = [description, ...benefits].join(" ")
    expect(copy).not.toMatch(/Premium|Profesyonel pakete|Profesyonel paket|Lite/)
    expect(title.length).toBeGreaterThan(0)
  }
})

test("plaka okuma pakete dahil bir özellik olarak tanımlı", () => {
  expect(FEATURE_CATALOG.plateScan).toMatchObject({ name: "Plaka okuma", kind: "package" })
  expect(FEATURE_CATALOG.ocrIntake.kind).toBe("addon")
})

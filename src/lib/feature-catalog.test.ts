import { expect, test } from "bun:test"
import { FEATURE_CATALOG, lockedFeatureLabels } from "@/lib/feature-catalog"
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

test("kilit rozetleri: ek özellik ekran okuyucuda tam adıyla, paket özelliği Servis Paketi'ne işaret eder", () => {
  const addon = lockedFeatureLabels("ocrIntake")
  expect(addon.badge + addon.badgeSrSuffix).toBe("Ek özellik")
  expect(addon.label).toBe("Ek özellik")
  expect(addon.description).toBe("Ek özellik")
  const pkg = lockedFeatureLabels("appointments")
  expect(pkg).toEqual({ badge: "Pakette", badgeSrSuffix: "", label: "Pakette", description: "Servis Paketi özelliği" })
  // rbac ek özellik DEĞİL; açıklaması bugün çalışan rol bazlı yetkileri anlatır.
  expect(FEATURE_CATALOG.rbac.kind).toBe("package")
  expect(FEATURE_CATALOG.rbac.description).not.toContain("ürünleştiğinde")
})

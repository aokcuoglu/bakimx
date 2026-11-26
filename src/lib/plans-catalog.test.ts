import { expect, test } from "bun:test"
import { ADDON_FEATURES, PLAN_TIERS, isAddonFeature, type GatedFeature } from "@/lib/plan"
import {
  ADDON_CATALOG,
  LEGACY_PLAN_PACKAGES,
  PHOTO_UPLOAD_POLICY,
  PLAN_COMPARISON,
  PLAN_PACKAGES,
  PLAN_PHOTO_POLICY,
  SERVICE_PACKAGE,
  getPlanPackage,
} from "@/lib/plans-catalog"

test("satış kataloğu tek paket sunar: Servis Paketi", () => {
  expect(PLAN_PACKAGES.map((plan) => plan.tier)).toEqual(["pro"])
  expect(PLAN_PACKAGES[0]).toBe(SERVICE_PACKAGE)
  expect(SERVICE_PACKAGE.name).toBe("Servis Paketi")
  expect(SERVICE_PACKAGE.seats).toBe(5)
})

test("Servis Paketi ₺1.499/ay, yıllık 10 × aylık = ₺14.990 (KDV dahil)", () => {
  const pkg = getPlanPackage("pro")
  expect(pkg?.monthlyPrice).toBe(1499)
  expect(pkg?.yearlyPrice).toBe(14990)
  expect(pkg?.yearlyPrice).toBe((pkg?.monthlyPrice ?? 0) * 10)
  expect(pkg?.monthlyLabel).toBe("₺1.499/ay")
  expect(pkg?.yearlyLabel).toBe("₺14.990/yıl")
})

test("getPlanPackage dört tier için de tanımlı — eski satırlar patlamaz", () => {
  for (const tier of PLAN_TIERS) expect(getPlanPackage(tier)?.tier).toBe(tier)
  expect(getPlanPackage("lite")).toMatchObject({ name: "Lite (eski)", monthlyPrice: 0, yearlyPrice: 0 })
  expect(getPlanPackage("starter")).toMatchObject({ name: "Başlangıç (eski)", monthlyPrice: 749, yearlyPrice: 7490 })
  expect(getPlanPackage("premium")).toMatchObject({ name: "Paket + ek özellikler", monthlyPrice: 2999, yearlyPrice: 29990 })
  expect(LEGACY_PLAN_PACKAGES.some((plan) => plan.tier === "pro")).toBe(false)
})

test("paket öne çıkanları ek özellik içermez, plaka okumayı içerir", () => {
  const highlights = SERVICE_PACKAGE.highlights.join(" ")
  expect(highlights).toContain("Plaka okuma")
  for (const addon of ADDON_CATALOG) expect(highlights).not.toContain(addon.name)
})

test("ek özellik kataloğu fiyat taşımaz ve her ek özellik kapısını kapsar", () => {
  for (const addon of ADDON_CATALOG) {
    expect(Object.keys(addon).sort()).toEqual(["description", "features", "key", "name", "shipped"])
    expect(JSON.stringify(addon)).not.toMatch(/price|₺|TL/i)
  }
  const covered = new Set(ADDON_CATALOG.flatMap((addon) => addon.features))
  expect([...ADDON_FEATURES].every((feature) => covered.has(feature))).toBe(true)
  expect(ADDON_CATALOG.map((addon) => addon.name)).toEqual([
    "Şaseden parça",
    "AI danışmanı",
    "Ruhsat OCR",
    "e-Fatura",
    "Çoklu şube",
  ])
  // Plaka okuma pakete dahil — ek özellik listesinde yer almaz.
  expect(ADDON_CATALOG.some((addon) => addon.name.includes("Plaka"))).toBe(false)
})

test("'Pakete dahil' tablosunda ek özellik satırı yok, plaka okuma var", () => {
  const rows = PLAN_COMPARISON.flatMap((category) => category.rows)
  const addonRows = rows.filter((row) => isAddonFeature(row.key as GatedFeature))
  expect(addonRows).toEqual([])
  expect(rows.some((row) => row.key === "live-catalog-quota")).toBe(false)
  expect(PLAN_COMPARISON.map((category) => category.key)).toEqual(["limits", "core", "intake", "operations"])
  const intake = PLAN_COMPARISON.find((category) => category.key === "intake")!
  expect(intake.rows.find((row) => row.key === "plateScan")?.values.pro).toEqual({ state: "included", label: "Dahil" })
  for (const row of rows) expect(row.values.pro.state).not.toBe("unavailable")
})

test("karşılaştırma limitleri merkezi koltuk ve fotoğraf sözleşmelerini yansıtır", () => {
  const limits = PLAN_COMPARISON.find((category) => category.key === "limits")!
  const seats = limits.rows.find((row) => row.key === "seats")!
  const photos = limits.rows.find((row) => row.key === "work-order-photos")!

  expect(seats.values.pro.label).toBe("5")
  expect(PLAN_PHOTO_POLICY).toEqual({ pro: { enabled: true, maxActivePerWorkOrder: 30 } })
  expect(photos.values.pro.label).toBe("30 aktif/araç kabulü")
})

test("fotoğraf açıklama değerleri gerçek yükleme sözleşmesinden türetilir", () => {
  expect(PHOTO_UPLOAD_POLICY).toEqual({
    rawSelectionMb: 20,
    compressionTargetMb: 1,
    serverLimitMb: 2,
    maxPerSelection: 3,
    maxActivePerWorkOrder: 30,
  })
})

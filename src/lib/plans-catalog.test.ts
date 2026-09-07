import { expect, test } from "bun:test"
import {
  PHOTO_UPLOAD_POLICY,
  PLAN_COMPARISON,
  PLAN_PACKAGES,
  PLAN_PHOTO_POLICY,
  getPlanPackage,
} from "@/lib/plans-catalog"

test("satış kataloğu üç güncel paketi doğru sırada sunar", () => {
  expect(PLAN_PACKAGES.map((plan) => plan.tier)).toEqual(["lite", "pro", "premium"])
})

test("Lite açılış kampanyası normal fiyatı koruyup ücretsiz satış fiyatı sunar", () => {
  const lite = getPlanPackage("lite")
  expect(lite?.monthlyPrice).toBe(0)
  expect(lite?.yearlyPrice).toBe(0)
  expect(lite && "listMonthlyLabel" in lite ? lite.listMonthlyLabel : undefined).toBe("₺499/ay")
})

test("birleşik Profesyonel ve Premium fiyatları yıllık iki ay bedava kuralına uyar", () => {
  const pro = getPlanPackage("pro")
  const premium = getPlanPackage("premium")
  expect(pro?.monthlyPrice).toBe(1799)
  expect(pro?.yearlyPrice).toBe(17990)
  expect(premium?.monthlyPrice).toBe(2999)
  expect(premium?.yearlyPrice).toBe(29990)
})

test("eski Başlangıç kayıtları okunabilir fakat satış kataloğunda yer almaz", () => {
  expect(getPlanPackage("starter")?.name).toBe("Başlangıç (eski)")
  expect(PLAN_PACKAGES.some((plan) => plan.tier === ("starter" as never))).toBe(false)
})

test("karşılaştırma limitleri merkezi koltuk, sorgu ve fotoğraf sözleşmelerini yansıtır", () => {
  const limits = PLAN_COMPARISON.find((category) => category.key === "limits")!
  const seats = limits.rows.find((row) => row.key === "seats")!
  const lookup = limits.rows.find((row) => row.key === "live-catalog-quota")!
  const photos = limits.rows.find((row) => row.key === "work-order-photos")!

  expect([seats.values.lite.label, seats.values.pro.label, seats.values.premium.label]).toEqual(["1", "5", "15"])
  expect([lookup.values.lite.label, lookup.values.pro.label, lookup.values.premium.label]).toEqual([
    "Yok",
    "5.000/ay",
    "15.000/ay",
  ])
  expect(PLAN_PHOTO_POLICY.lite).toEqual({ enabled: false, maxActivePerWorkOrder: 0 })
  expect(photos.values.lite.label).toBe("Yok")
  expect(photos.values.pro.label).toBe("30 aktif/iş emri")
  expect(photos.values.premium.label).toBe("30 aktif/iş emri")
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

test("Premium yol haritasındaki üç özellik de yalnız Premium için Yakında görünür", () => {
  const roadmap = PLAN_COMPARISON.find((category) => category.key === "roadmap")!
  expect(roadmap.rows).toHaveLength(3)
  for (const row of roadmap.rows) {
    expect(row.values.lite.state).toBe("unavailable")
    expect(row.values.pro.state).toBe("unavailable")
    expect(row.values.premium).toEqual({ state: "coming-soon", label: "Yakında" })
  }
})

test("Lite pazarlama metni fotoğraf yükleme vaadi içermez", () => {
  expect(getPlanPackage("lite")?.highlights.join(" ").toLocaleLowerCase("tr-TR")).not.toContain("fotoğraf")
})

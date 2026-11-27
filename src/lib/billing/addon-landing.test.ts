import { expect, test } from "bun:test"
import { resolveAddonLanding } from "@/lib/billing/addon-landing"
import { DEFAULT_ADDON_ROW_VIEWS, type AddonRowState, type AddonRowViews } from "@/lib/billing/addon-row-state"

function views(state: AddonRowState, key: keyof AddonRowViews = "vinLookup"): AddonRowViews {
  return { ...DEFAULT_ADDON_ROW_VIEWS, [key]: { state, openFeatures: [] } }
}
const base = { canPurchase: true, hasPendingOrder: false }

test("satın alınabilir ve yetkili: pencere açılır", () => {
  expect(resolveAddonLanding({ ...base, requested: "vinLookup", views: views("purchasable") })).toEqual({ initialAddon: "vinLookup" })
})

test("yetkisiz kullanıcıya pencere açılmaz, neden söylenir", () => {
  const r = resolveAddonLanding({ ...base, canPurchase: false, requested: "vinLookup", views: views("purchasable") })
  expect(r.initialAddon).toBeUndefined()
  expect(r.notice?.message).toBe("Satın alma için yöneticinizle görüşün.")
})

test("ana şube değilse ve paket yoksa nedenleri ayrı", () => {
  expect(resolveAddonLanding({ ...base, requested: "ocrIntake", views: views("notAccount", "ocrIntake") }).notice?.message)
    .toBe("Ek özellikler ana şubeden satın alınır.")
  const needs = resolveAddonLanding({ ...base, requested: "vinLookup", views: views("needsPackage") })
  expect(needs.notice?.reason).toBe("needsPackage")
  expect(needs.notice?.message).toBe("Ek özellik almak için önce Servis Paketi gerekir.")
})

test("bekleyen sipariş varken pencere otomatik açılmaz", () => {
  const r = resolveAddonLanding({ ...base, hasPendingOrder: true, requested: "vinLookup", views: views("purchasable") })
  expect(r.initialAddon).toBeUndefined()
  expect(r.notice?.message).toBe("Bekleyen bir ödeme talebiniz var.")
})

test("denemede açık özellik: bilgi notu, pencere yok", () => {
  const r = resolveAddonLanding({ ...base, requested: "vinLookup", views: views("trial") })
  expect(r.initialAddon).toBeUndefined()
  expect(r.notice?.message).toBe("Denemede bu özellik açık.")
})

test("çoklu şube (satılmayan) reddedilir; geçersiz anahtar ve etkin özellik sessiz", () => {
  const multi = resolveAddonLanding({ ...base, requested: "multiBranch", views: views("contact", "multiBranch") })
  expect(multi.initialAddon).toBeUndefined()
  expect(multi.notice?.reason).toBe("contact")
  expect(resolveAddonLanding({ ...base, requested: "nope", views: views("purchasable") })).toEqual({ notice: null })
  expect(resolveAddonLanding({ ...base, requested: undefined, views: views("purchasable") })).toEqual({ notice: null })
  expect(resolveAddonLanding({ ...base, requested: "vinLookup", views: views("active") })).toEqual({ notice: null })
})

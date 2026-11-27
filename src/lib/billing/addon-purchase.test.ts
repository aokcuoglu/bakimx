import { expect, test } from "bun:test"
import { ADDON_SECTION_ID, addonPurchaseHref, purchasableAddonKeyForFeature } from "@/lib/billing/addon-purchase"

test("satın alınabilen kapılar ek özelliğe eşlenir; satılmayanlar eşlenmez", () => {
  expect(purchasableAddonKeyForFeature("vinLookup")).toBe("vinLookup")
  expect(purchasableAddonKeyForFeature("partsCatalog")).toBe("vinLookup")
  expect(purchasableAddonKeyForFeature("ocrIntake")).toBe("ocrIntake")
  expect(purchasableAddonKeyForFeature("multiBranch")).toBeNull()
  expect(purchasableAddonKeyForFeature("eInvoice")).toBeNull()
  expect(purchasableAddonKeyForFeature("quotes")).toBeNull()
})

test("bağlantı ayarlar sayfasındaki ek özellikler bölümüne iner", () => {
  expect(addonPurchaseHref("ocrIntake")).toBe(`/settings/plans?addon=ocrIntake#${ADDON_SECTION_ID}`)
})

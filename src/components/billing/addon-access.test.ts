import { expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { AddonAccessProvider, resolveAddonAccess } from "./addon-access"
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { VinLinkPrompt } from "@/components/parts/vin-link-prompt"
import { lockedHistoryHint } from "@/lib/vehicle-history/locked-copy"

const vehicle = { id: "v1", vin: "WVWZZZ1JZXW000001" } as Parameters<typeof VinLinkPrompt>[0]["vehicle"]

function render(enabled: Parameters<typeof resolveAddonAccess>[0], role: string) {
  return renderToStaticMarkup(
    createElement(
      AppRouterContext.Provider,
      { value: {} as AppRouterInstance },
      createElement(AddonAccessProvider, { enabledFeatures: enabled, role }, createElement(VinLinkPrompt, { vehicle })),
    ),
  )
}

test("resolveAddonAccess: açık özellik listesi ve saha rolünde upsell yok (#853)", () => {
  const owner = resolveAddonAccess(["partsCatalog"], "owner")
  expect(owner.has("partsCatalog")).toBe(true)
  expect(owner.has("vinLookup")).toBe(false)
  expect(owner.showUpsell).toBe(true)
  expect(resolveAddonAccess([], "usta").showUpsell).toBe(false)
})

test("VinLinkPrompt: şase ek özelliği kapalıyken düğme yok, yöneticiye kilit notu (#853)", () => {
  const html = render([], "owner")
  expect(html).not.toContain("Şaseden bağla")
  expect(html).toContain("VIN ile araç tanıma")
  expect(html).toContain("Ek özellik")
})

test("VinLinkPrompt: saha rolünde kilit notu da yok, elle yol var", () => {
  const html = render([], "usta")
  expect(html).not.toContain("Ek özellik")
  expect(html).not.toContain("Şaseden bağla")
  expect(html).toContain("/vehicles/v1/edit")
})

test("VinLinkPrompt: ek özellik açıkken düğme çizilir", () => {
  expect(render(["vinLookup"], "owner")).toContain("Şaseden bağla")
})

test("maskeli geçmiş cümlesi: OCR kapalıyken ruhsat vaadi yok (#853)", () => {
  expect(lockedHistoryHint(true).action).toContain("ruhsatı okuttuğunuzda")
  const off = lockedHistoryHint(false)
  expect(off.action).not.toContain("ruhsat")
  expect(off.action).toContain("araç kabulü")
})

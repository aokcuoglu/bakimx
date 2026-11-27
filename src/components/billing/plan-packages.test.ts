import { expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PlanPackages } from "./plan-packages"
import { resolveAddonRowViews } from "@/lib/billing/addon-row-state"

const common = { ownedTier: null, workshopName: "Test", hasPendingOrder: false, canPurchase: true } as const

test("herkese açık /fiyatlar ek özellik fiyatı ve 'Ek özellik' rozeti göstermez (#1054 takibi)", () => {
  const html = renderToStaticMarkup(createElement(PlanPackages, { ...common, presentation: "public", checkoutBasePath: "/register" }))
  expect(html).toContain("Şaseden parça")
  expect(html).not.toContain("₺399")
  expect(html).not.toContain("₺249")
  expect(html).not.toContain("Ek özellik<")
  expect(html).toContain("Yakında")
})

test("ayarlar görünümü ek özellik fiyatını KDV dahil, kuruşsuz gösterir", () => {
  const views = resolveAddonRowViews(
    { subscriptionStatus: "active", planTier: "pro", currentPeriodEnd: new Date(Date.now() + 86_400_000 * 20), addons: [] } as never,
    { isAccountWorkshop: true },
  )
  const html = renderToStaticMarkup(
    createElement(PlanPackages, { ...common, presentation: "settings", checkoutBasePath: "/checkout", addonViews: views }),
  )
  expect(html).toContain("₺399/ay · KDV dahil")
  expect(html).toContain("₺3.990/yıl")
  expect(html).not.toContain("₺399,00")
  expect(html).toContain("Ek özellik")
})

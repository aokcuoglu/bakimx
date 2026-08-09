import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

const authenticatedRoutes = [
  { name: "kabul", path: "/intakes" },
  { name: "teknisyen", path: "/technician/orders" },
  { name: "iş emri listesi", path: "/orders" },
  { name: "uygulama kabuğu", path: "/dashboard" },
]

async function assertMobileKeyboardAndA11y(page: Page) {
  await expect(page.locator("body")).toBeVisible()

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, "360 px görünümde yatay taşma").toBeLessThanOrEqual(1)

  await page.keyboard.press("Tab")
  const focused = page.locator(":focus")
  await expect(focused, "Tab ile görünür bir odağa ulaşılmalı").toBeVisible()

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()
  const critical = results.violations.filter((violation) => violation.impact === "critical")
  expect(critical, "Axe kritik ihlalleri").toEqual([])
}

for (const route of authenticatedRoutes) {
  test(`${route.name}: 360 px klavye, focus ve axe smoke`, async ({ page }) => {
    await page.goto(`/api/auth/dev-login?email=admin@bakimx.com&redirect=${encodeURIComponent(route.path)}`)
    await page.waitForLoadState("networkidle")
    await assertMobileKeyboardAndA11y(page)
  })
}

test("public yüzey: 360 px klavye, focus ve axe smoke", async ({ page }) => {
  await page.goto("/privacy")
  await page.waitForLoadState("networkidle")
  await assertMobileKeyboardAndA11y(page)
})

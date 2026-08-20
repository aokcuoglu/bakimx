import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test("iş emri programı sayfası mobilde taşmadan ve erişilebilir açılır", async ({ page }) => {
  await page.goto("/is-emri-programi")

  await expect(page).toHaveTitle(/İş Emri Programı: İş, Parça, İşçilik ve Onay Tek Ekranda/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://bakimx.com/is-emri-programi")
  await expect(page.getByRole("heading", { level: 1, name: /İş emri programı/ })).toBeVisible()
  await expect(page.getByRole("link", { name: "7 gün ücretsiz deneyin" })).toHaveCount(2)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, "360 px görünümde yatay taşma").toBeLessThanOrEqual(1)

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()
  expect(results.violations).toEqual([])
})

test("ana CTA klavyeyle odaklanabilir", async ({ page }) => {
  await page.goto("/is-emri-programi")
  const primaryCtas = page.getByRole("link", { name: "7 gün ücretsiz deneyin" })

  await primaryCtas.first().focus()
  await expect(primaryCtas.first()).toBeFocused()
})

import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test("karşılaştırma sayfası 360 px görünümde klavyeyle erişilebilir", async ({ page }) => {
  await page.goto("/karsilastir/defter-excel-oto-servis-programi")

  await expect(page).toHaveTitle(/Defter, Excel ve Oto Servis Programı Karşılaştırması/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://bakimx.com/karsilastir/defter-excel-oto-servis-programi",
  )
  await expect(page.locator('main a[href="/demo"]')).toHaveCount(1)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, "360 px görünümde sayfa yatay taşmamalı").toBeLessThanOrEqual(1)

  const comparisonTable = page.getByLabel("Defter, Excel ve oto servis programı karşılaştırma tablosu")
  await comparisonTable.focus()
  await expect(comparisonTable).toBeFocused()

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()
  expect(results.violations).toEqual([])
})

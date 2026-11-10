import { expect, test } from "@playwright/test"

// Read-only acceptance against the seeded local workshop.
test("dashboard summaries stay readable and fit the available width", async ({ page }) => {
  await page.goto("/api/auth/dev-login?redirect=/dashboard")
  const operations = page.getByLabel("Operasyon özeti")
  const reports = page.getByLabel("Aylık rapor özeti")
  await expect(operations).toBeVisible()
  await expect(reports).toBeVisible()

  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 })
    const availableWidth = (await operations.boundingBox())!.width
    const columns = availableWidth >= 720 ? 3 : availableWidth >= 340 ? 2 : 1
    await expect(operations.locator(":scope > div")).toHaveCSS("grid-template-columns", new RegExp(`^(?:[\\d.]+px\\s*){${columns}}$`))
    for (const summary of [operations, reports]) {
      const cards = summary.locator('[data-slot="highlight-card"]')
      for (const card of await cards.all()) {
        await expect(card.locator('[data-slot="highlight-label"]')).toHaveCSS("font-size", "14px")
        await expect(card.locator('[data-slot="highlight-value"]')).toHaveCSS("font-size", availableWidth >= 600 ? "24px" : "22px")
        expect(await card.evaluate(e => e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight)).toBe(true)
      }
    }
    expect((await operations.locator('[data-slot="highlight-card"]').first().boundingBox())!.height).toBeLessThanOrEqual(112)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `artifacts/issue-718/dashboard-${width}.png`, fullPage: false })
  }

  // Sidebar width changes should adapt the grid without changing the viewport.
  await page.setViewportSize({ width: 1024, height: 1000 })
  await operations.evaluate(e => { e.style.maxWidth = "330px" })
  await expect(operations.locator(":scope > div")).toHaveCSS("grid-template-columns", /^[\d.]+px$/)
  await operations.evaluate(e => { e.style.maxWidth = "" })

  // Large financial values wrap rather than being clipped or truncated.
  await page.setViewportSize({ width: 390, height: 1000 })
  const amount = reports.locator('[data-slot="highlight-value"]').first()
  await amount.evaluate(e => { e.textContent = "₺123.456.789.012.345,67" })
  const reportCard = reports.locator('[data-slot="highlight-card"]').first()
  expect(await reportCard.evaluate(e => e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight)).toBe(true)
  await operations.getByRole("link").first().focus()
  await expect(operations.getByRole("link").first()).toBeFocused()
  expect(await operations.getByRole("link").first().evaluate(e => getComputedStyle(e).boxShadow)).not.toBe("none")
})

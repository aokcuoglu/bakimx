import { expect, test } from "@playwright/test"

// Read-only local acceptance. Stress text is inserted only into the browser DOM.
test("analytics keeps long service names and amounts inside their columns", async ({ page }) => {
  await page.goto("/api/auth/dev-login?redirect=/analytics")
  const customers = page.getByRole("table", { name: "En Yüksek Değerli Müşteriler", exact: true })
  await expect(customers).toBeVisible()
  await expect(customers.getByRole("columnheader", { name: "Telefon", exact: true })).toBeAttached()
  const services = ["En Sık Şikayetler", "En Sık Onarımlar", "En Çok Yapılan İşçilikler"]
  for (const name of services) {
    const table = page.getByRole("table", { name, exact: true })
    await expect(table).toBeVisible()
    await expect(table.getByRole("columnheader", { name: "Adet", exact: true })).toBeVisible()
    await table.locator("tbody tr").first().evaluate((row) => {
      const cells = row.querySelectorAll("td")
      if (cells.length < 2) throw new Error("Seeded service data is required")
      cells[0].textContent = "Uzun servis açıklaması ve işçilik adı ".repeat(6) + "KesintisizParçaKodu".repeat(10)
      cells[1].textContent = "12345678"
      if (cells[2]) cells[2].textContent = "₺123.456.789.012,34"
    })
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    for (const name of services) {
      const table = page.getByRole("table", { name, exact: true })
      expect(await table.locator("td, th").evaluateAll((cells) => cells.every((cell) => cell.scrollWidth <= cell.clientWidth + 1))).toBe(true)
    }
    // Wide customer tables scroll inside the panel; contact columns remain available.
    expect(await customers.locator("..").evaluate((container) => container.getBoundingClientRect().right <= innerWidth)).toBe(true)
  }
  // Preserve the existing customer detail navigation and keyboard access.
  const customerLink = customers.locator('a[href^="/customers/"]').first()
  await customerLink.focus()
  await expect(customerLink).toBeFocused()
  await expect(customerLink).toHaveAttribute("href", /\/customers\/.+/)
})

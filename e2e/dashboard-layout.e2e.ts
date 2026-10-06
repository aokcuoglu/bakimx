import { expect, test } from "@playwright/test"

// Read-only local acceptance against the seeded workshop.
test("dashboard panels fit mobile and desktop with aligned card heights", async ({ page }) => {
  await page.goto("/api/auth/dev-login?redirect=/dashboard")
  const photos = page.getByRole("region", { name: "Eksik fotoğraflar", exact: true })
  await expect(photos.getByRole("table")).toBeVisible()
  const firstLink = photos.locator('a[href^="/orders/"]').first()
  await firstLink.locator("span").last().evaluate((name) => {
    name.textContent = "Uzun müşteri şirket adı ".repeat(20)
  })
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await photos.locator("td, th").evaluateAll((cells) => cells.every((cell) => cell.scrollWidth <= cell.clientWidth + 1))).toBe(true)
    const delivery = page.getByRole("region", { name: "Bugün teslim edilecekler", exact: true })
    const box = await delivery.boundingBox()
    expect(box!.height).toBeLessThan(160)
    const pairedHeights = await page.evaluate(() => {
      const customer = document.querySelector('section[aria-label="Son müşteriler"]')!.getBoundingClientRect()
      const technician = document.querySelector('section[aria-label="Usta iş durumu"]')!.getBoundingClientRect()
      return { sameRow: Math.abs(customer.top - technician.top) < 1, difference: Math.abs(customer.height - technician.height) }
    })
    if (pairedHeights.sameRow) expect(pairedHeights.difference).toBeLessThanOrEqual(1)
    await expect(page.getByRole("region", { name: "Usta iş durumu", exact: true }).getByRole("heading").locator("svg")).toHaveCount(0)
    await firstLink.focus()
    await expect(firstLink).toBeFocused()
    await expect(firstLink).toHaveAttribute("href", /\/orders\/.+/)
  }
  // Cash and reminders share the available desktop width instead of leaving a column empty.
  const positions = await page.evaluate(() => {
    const cash = [...document.querySelectorAll("h3")].find((el) => el.textContent?.trim() === "Kasa Özeti")!
    const reminder = [...document.querySelectorAll('[data-slot="card-title"]')].find((el) => el.textContent?.includes("Bakım Hatırlatmaları"))!
    return { cash: cash.getBoundingClientRect().toJSON(), reminder: reminder.getBoundingClientRect().toJSON() }
  })
  expect(Math.abs(positions.cash.y - positions.reminder.y)).toBeLessThan(16)
  expect(positions.reminder.x).toBeGreaterThan(positions.cash.x)
})

test("photo pagination preserves keyboard navigation and warning actions", async ({ page }) => {
  await page.goto("/api/auth/dev-login?redirect=/dashboard")
  const photos = page.getByRole("region", { name: "Eksik fotoğraflar", exact: true })
  await expect(photos.getByRole("table")).toBeVisible()
  const firstHref = await photos.locator('a[href^="/orders/"]').first().getAttribute("href")
  await expect(photos.getByRole("button", { name: "Önceki sayfa" })).toBeDisabled()
  const next = photos.getByRole("button", { name: "Sonraki sayfa" })
  await next.focus()
  await page.keyboard.press("Enter")
  await expect(photos.getByText("Sayfa 2 /", { exact: false })).toBeVisible()
  expect(await photos.locator('a[href^="/orders/"]').first().getAttribute("href")).not.toBe(firstHref)
  await photos.getByRole("button", { name: "Önceki sayfa" }).click()
  await expect(photos.locator('a[href^="/orders/"]').first()).toHaveAttribute("href", firstHref!)
  const warning = page.getByRole("region", { name: "Dikkat gerektiren işler" })
  const action = warning.getByRole("link", { name: "İş emirlerini incele →" }).first()
  await action.focus()
  await expect(action).toBeFocused()
  await expect(action).toHaveAttribute("href", "/orders")
})

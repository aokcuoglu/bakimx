import { expect, test } from "@playwright/test"

for (const width of [320, 390]) {
  test(`mobile app shell and page actions fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto("/api/auth/dev-login?redirect=/dashboard")

    const header = page.locator("[data-slot=sidebar-inset] > header")
    await expect(header).toHaveCSS("height", "48px")
    await expect(header.getByText("Genel Bakış")).toBeHidden()
    await expect(header.getByRole("link", { name: "BakimX" })).toBeVisible()
    await expect(page.getByRole("heading", { name: /Hoş Geldiniz/ })).toBeVisible()

    for (const [path, title, action] of [
      ["/orders", "İş Emirleri", "Yeni iş emri"],
      ["/vehicles", "Araçlar", "Yeni araç"],
      ["/appointments", "Randevular", "Yeni randevu"],
    ]) {
      await page.goto(path)
      await expect(header.getByRole("heading", { name: title })).toBeVisible()
      await expect(header.getByRole("link", { name: action })).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(1)
    }

    await page.goto("/purchases")
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow, `purchases at ${width}px`).toBeLessThanOrEqual(1)
    await expect(page.getByRole("button", { name: "Filtrele" })).toBeInViewport()
  })
}

test("team detail tabs stay within a 320px page and remain reachable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto("/api/auth/dev-login?redirect=/settings/members-and-teams/teams")
  const teamLink = page.locator('a[href^="/settings/members-and-teams/teams/"]:not([href$="/members"]):not([href$="/usage"])').first()
  test.skip(await teamLink.count() === 0, "A seeded team is required for detail page QA")

  await expect(teamLink).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  await teamLink.click()
  const tabs = page.getByRole("tablist")
  await expect(tabs).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  const scrollArea = tabs.locator("..")
  await scrollArea.evaluate((element) => { element.scrollLeft = element.scrollWidth })
  await expect(tabs.getByRole("tab", { name: /Kullanım/ })).toBeInViewport()
})

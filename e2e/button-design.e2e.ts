import { expect, test } from "@playwright/test"

for (const width of [320, 390, 768, 1440]) {
  test(`Attio button geometry and keyboard access at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    const hero = page.locator("#hero").getByRole("link", { name: "Ücretsiz başlayın" })
    await expect(hero).toHaveCSS("height", "28px")
    await expect(hero).toHaveCSS("padding-left", "6px")
    await expect(hero).toHaveCSS("border-radius", "8px")
    await expect(hero).toHaveCSS("font-size", "14px")
    await expect(hero).toHaveCSS("font-weight", "500")
    await expect(hero).toHaveCSS("font-family", /Inter/)
    await expect(hero).toHaveCSS("text-align", "center")
    await expect(hero).toHaveCSS("color", "rgb(255, 255, 255)")
    await expect(hero).toHaveCSS("line-height", "20px")
    await expect(hero).toHaveCSS("letter-spacing", "-0.07px")
    await expect(hero).toHaveAttribute("href", "/register")

    const header = page.getByRole("banner")
    if (width < 1024) {
      const menu = header.getByRole("button", { name: "Menüyü aç" })
      await menu.focus()
      await page.keyboard.press("Enter")
      await expect(header.getByRole("link", { name: "Ücretsiz dene" })).toHaveCSS("height", "28px")
      await page.keyboard.press("Escape")
      await expect(menu).toBeFocused()
    } else {
      const cta = header.getByRole("link", { name: "Ücretsiz dene" })
      await expect(cta).toHaveCSS("height", "28px")
      await expect(cta).toHaveCSS("padding-left", "6px")
      await expect(cta).toHaveCSS("padding-right", "8px")
      await cta.focus()
      await page.keyboard.press("Shift+Tab")
      await page.keyboard.press("Tab")
      await expect(cta).toBeFocused()
      expect(await cta.evaluate((el) => el.matches(":focus-visible"))).toBe(true)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}

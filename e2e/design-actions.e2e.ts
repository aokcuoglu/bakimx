import { expect, test } from "@playwright/test"

test("registration actions share the same button geometry", async ({ page }) => {
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/register")

    const home = page.getByRole("link", { name: "Ana Sayfa", exact: true })
    const submit = page.getByRole("button", { name: "Ücretsiz Hesabımı Oluştur" })
    await expect(home).toHaveAttribute("data-variant", "outline")
    await expect(submit).toHaveAttribute("data-variant", "foreground")

    const geometry = async (element: typeof home) => element.evaluate((node) => ({
      height: node.getBoundingClientRect().height,
      radius: getComputedStyle(node).borderRadius,
      fontSize: getComputedStyle(node).fontSize,
    }))
    expect(await geometry(submit)).toEqual(await geometry(home))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

test("blog category tabs have complete ARIA relationships and keyboard navigation", async ({ page }) => {
  await page.goto("/blog")
  const tabs = page.getByRole("tab")
  await expect(tabs).toHaveCount(5)
  expect(await tabs.evaluateAll((elements) => elements.every((element) => {
    const id = element.getAttribute("aria-controls")
    return id !== null && document.getElementById(id)?.getAttribute("role") === "tabpanel"
  }))).toBe(true)

  await tabs.first().click()
  await tabs.first().focus()
  await page.keyboard.press("ArrowRight")
  await expect(page.getByRole("tab", { name: "#Operasyon" })).toHaveAttribute("aria-selected", "true")
  await expect(page.getByRole("tabpanel").locator("article")).toHaveCount(1)
})

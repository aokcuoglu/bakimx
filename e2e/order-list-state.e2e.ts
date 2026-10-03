import { expect, test } from "@playwright/test"

for (const width of [390, 1440]) {
  test(`order list preserves filters on detail return at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/api/auth/dev-login?redirect=/orders")
    await page.getByRole("textbox", { name: "İş emri ara", exact: true }).fill("34")
    await page.getByRole("textbox", { name: "İş emri ara", exact: true }).press("Enter")
    await page.getByRole("combobox", { name: "Tüm Ödemeler", exact: true }).click()
    await page.getByRole("option", { name: "Ödenmedi", exact: true }).click()
    await expect(page).toHaveURL(/payment=unpaid/)
    if (width === 1440) {
      await page.getByRole("button", { name: "Kolonlar", exact: true }).click()
      await page.getByRole("menuitemcheckbox", { name: "Tahmini teslim", exact: true }).click()
      await page.keyboard.press("Escape")
      await page.getByRole("table").getByRole("button", { name: "Giriş tarihi", exact: true }).click()
      await page.getByRole("menuitem", { name: "Artan", exact: true }).click()
      await page.getByRole("table").getByRole("button", { name: "Araç", exact: true }).click()
      await page.getByRole("textbox", { name: "Araç filtresi", exact: true }).fill("34")
      await page.keyboard.press("Escape")
    }
    const tableView = new URL(page.url()).searchParams.get("view")
    await page.getByRole("combobox", { name: "Tüm Durumlar", exact: true }).click()
    await page.getByRole("option", { name: "Aktif", exact: true }).click()
    await expect(page).toHaveURL(/status=active/)
    expect(new URL(page.url()).searchParams.get("view")).toBe(tableView)
    const listUrl = page.url()
    await page.locator('a[href^="/orders/"][href*="returnTo="]:visible').filter({ hasText: /^BX/ }).first().click()
    await expect(page.getByRole("button", { name: "İş emirleri", exact: true })).toBeVisible()
    // Reload the detail to prove this does not depend on an in-memory cache.
    await page.reload()
    await page.getByRole("button", { name: "İş emirleri", exact: true }).click()
    await expect(page).toHaveURL(listUrl)
    await expect(page.getByRole("combobox", { name: "Tüm Ödemeler", exact: true })).toContainText("Ödenmedi")
    await expect(page.getByRole("textbox", { name: "İş emri ara", exact: true })).toHaveValue("34")
    if (width === 1440) {
      await expect(page.getByRole("columnheader", { name: "Tahmini teslim", exact: true })).toBeVisible()
      await page.getByRole("table").getByRole("button", { name: "Araç", exact: true }).click()
      await expect(page.getByRole("textbox", { name: "Araç filtresi", exact: true })).toHaveValue("34")
      await page.keyboard.press("Escape")
    }
    await page.goBack()
    await expect(page.getByRole("button", { name: "İş emirleri", exact: true })).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(listUrl)
    await page.getByRole("link", { name: "Temizle", exact: true }).click()
    await expect(page).toHaveURL(/\/orders$/)
    await expect(page.getByRole("textbox", { name: "İş emri ara", exact: true })).toHaveValue("")
    await expect(page.getByRole("combobox", { name: "Tüm Ödemeler", exact: true })).toContainText("Tüm Ödemeler")
    await page.goBack()
    await expect(page).toHaveURL(listUrl)
    await expect(page.getByRole("combobox", { name: "Tüm Ödemeler", exact: true })).toContainText("Ödenmedi")
  })
}

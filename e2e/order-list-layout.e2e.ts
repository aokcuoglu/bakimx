import { expect, test } from "@playwright/test"

// Read-only acceptance against the seeded local workshop.
test("order list separates status, payment and dates without wrapping cells", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/api/auth/dev-login?redirect=/orders")
  const table = page.getByRole("table")
  await expect(table).toBeVisible()
  await expect(table.getByRole("columnheader", { name: "Durum", exact: true })).toBeVisible()
  await expect(table.getByRole("columnheader", { name: "Ödeme", exact: true })).toBeVisible()
  await expect(table.getByRole("columnheader", { name: "Giriş tarihi", exact: true })).toBeVisible()
  await expect(table.getByRole("columnheader", { name: "Tahmini teslim", exact: true })).toHaveCount(0)
  const firstRow = table.locator("tbody tr").first()
  await expect(firstRow).toBeVisible()
  await expect(firstRow.locator("td").nth(3)).not.toHaveText(/Ödenmedi|Kısmi ödeme|Ödendi/)
  const missing = table.getByText("Fatura yok", { exact: true }).first()
  await expect(missing).toBeVisible()
  await expect(missing).toHaveCSS("white-space", "nowrap")
  expect((await firstRow.boundingBox())!.height).toBeLessThanOrEqual(44)

  // Hidden delivery remains independently available, with its own filter and sort.
  await page.getByRole("button", { name: "Kolonlar" }).click()
  await page.getByRole("menuitemcheckbox", { name: "Tahmini teslim", exact: true }).click()
  await page.keyboard.press("Escape")
  await expect(table.getByRole("columnheader", { name: "Tahmini teslim", exact: true })).toBeVisible()
  await table.getByRole("button", { name: "Ödeme", exact: true }).click()
  await page.getByRole("textbox", { name: "Ödeme filtresi" }).fill("Kısmi")
  await page.keyboard.press("Escape")
  await expect(table.locator("tbody tr")).not.toHaveCount(0)
  for (const row of await table.locator("tbody tr").all()) {
    await expect(row.locator("td").nth(4)).toHaveText("Kısmi ödeme")
    await expect(row.locator("td").nth(3)).not.toHaveText(/Kısmi ödeme/)
  }
  await table.getByRole("button", { name: "Ödeme", exact: true }).click()
  await page.getByRole("menuitem", { name: "Filtreyi temizle" }).click()
  await table.getByRole("button", { name: "Giriş tarihi", exact: true }).click()
  await page.getByRole("menuitem", { name: "Artan", exact: true }).click()
  const dates = await table.locator("tbody tr td:nth-child(8)").allTextContents()
  const timestamps = dates.map((value) => value.trim().split(".").reverse().join("-"))
  expect(timestamps).toEqual([...timestamps].sort())

  const customerHint = firstRow.locator("td").nth(2).locator("[tabindex]")
  await customerHint.focus()
  await expect(page.getByRole("tooltip")).toBeVisible()
  await expect(page.getByRole("tooltip")).toContainText("·")
  await page.keyboard.press("Escape")
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})

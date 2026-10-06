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

test("technician controls align and the compact page preserves search filters", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/api/auth/dev-login?redirect=/orders")
  const technicians = page.locator("tbody tr td:nth-child(9)")
  await expect(technicians.getByRole("button").first()).toBeVisible()
  const positions = await technicians.evaluateAll((cells) => cells.map((cell) => {
    const icon = cell.querySelector("svg")!
    return icon.getBoundingClientRect().left
  }))
  expect(positions.length).toBeGreaterThan(1)
  expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(1)
  await expect(technicians.filter({ hasText: "Ali Teknisyen" }).locator("span.cursor-default").first()).toBeVisible()
  const summary = page.getByLabel("İş emri durum özeti")
  expect((await summary.boundingBox())!.height).toBeLessThanOrEqual(40)

  await page.getByRole("textbox", { name: "İş emri ara", exact: true }).fill("34")
  await page.getByRole("textbox", { name: "İş emri ara", exact: true }).press("Enter")
  await expect(page).toHaveURL(/q=34/)
  await summary.getByRole("link", { name: /^Aktif/ }).click()
  await expect(page).toHaveURL(/q=34/)
  await expect(page).toHaveURL(/status=active/)
  await page.getByRole("link", { name: "Temizle", exact: true }).click()
  await expect(page).toHaveURL(/\/orders$/)
  await page.getByRole("textbox", { name: "İş emri ara", exact: true }).fill("no-match-709-qa")
  await page.getByRole("textbox", { name: "İş emri ara", exact: true }).press("Enter")
  await expect(page.getByText("Filtrelere uyan iş emri bulunamadı", { exact: true })).toBeVisible()
  await expect(page.getByText("Bu filtrelere uyan iş emri yok", { exact: true })).toHaveCount(0)
  await page.getByRole("link", { name: "Filtreleri temizle", exact: true }).click()
  await expect(page.getByRole("table")).toBeVisible()
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByRole("textbox", { name: "İş emri ara", exact: true })).toBeVisible()
  }
})

test("filter options stay on one line and menus fit the viewport", async ({ page }) => {
  await page.goto("/api/auth/dev-login?redirect=/orders")
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const name of ["Tüm Durumlar", "Tüm Ödemeler", "Tüm Ustalar", "Tüm Faturalar"]) {
      await page.getByRole("combobox", { name, exact: true }).click()
      const menu = page.getByRole("listbox")
      await expect(menu).toBeVisible()
      const box = (await menu.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      const options = page.getByRole("option")
      for (const option of await options.all()) {
        await expect(option).toHaveCSS("white-space", "nowrap")
        expect((await option.boundingBox())!.height).toBeLessThanOrEqual(32)
      }
      await page.keyboard.press("Escape")
      await expect(page.getByRole("combobox", { name, exact: true })).toBeFocused()
    }
  }
})

import { expect, test } from "@playwright/test"

test("order list search and clear render without missing child keys", async ({ page }) => {
  const keyWarnings: string[] = []
  page.on("console", (message) => {
    if (/Each child in a list|same key/.test(message.text())) keyWarnings.push(message.text())
  })
  await page.goto("/api/auth/dev-login?redirect=/orders")
  const search = page.getByRole("textbox", { name: "Araç kabulü ara", exact: true })
  await expect(search).toBeVisible()
  await search.fill("34")
  await search.press("Enter")
  await expect(page).toHaveURL(/q=34/)
  await expect(search).toHaveValue("34")
  await page.getByLabel("Araç kabul durum özeti").getByRole("link", { name: /^Aktif/ }).click()
  await expect(page).toHaveURL(/status=active/)
  // Filtreler varsayılan kapalı; "Temizle" panelin içinde.
  await page.getByRole("button", { name: /Filtreler/ }).click()
  await page.getByRole("link", { name: "Temizle", exact: true }).click()
  await expect(page).toHaveURL(/\/orders$/)
  await expect(search).toHaveValue("")
  await page.goBack()
  await expect(search).toHaveValue("34")
  expect(keyWarnings).toEqual([])
})

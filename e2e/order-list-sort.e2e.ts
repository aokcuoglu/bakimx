import { expect, test } from "@playwright/test"

/**
 * Kolon sıralaması sunucuda ve TÜM kayıtlar üzerinde (#831). Kolon başlığındaki
 * arama kaldırıldı; "Daha fazla yükle" sıralamayı korur.
 */

/** "₺1.234,00" → 123400; fiyatsız satır ("—") → null. */
function parseTotal(text: string): number | null {
  const digits = text.replace(/\D/g, "")
  return digits ? Number(digits) : null
}

test("column header has sorting only, no column search", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/api/auth/dev-login?redirect=/orders")
  await page.getByRole("table").getByRole("button", { name: "Araç: sırala", exact: true }).click()
  await expect(page.getByRole("radio", { name: "A → Z", exact: true })).toBeVisible()
  await expect(page.getByRole("textbox", { name: /kolonunda ara/ })).toHaveCount(0)
})

test("total sort is server-side across all records and survives Daha fazla yükle", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/api/auth/dev-login?redirect=/orders")
  const rows = page.getByRole("table").locator("tbody tr")
  const loadMore = page.getByRole("button", { name: "Daha fazla yükle", exact: true })
  await expect(page.getByRole("table")).toBeVisible()
  test.skip(!(await loadMore.isVisible()), "100'den fazla araç kabulü gerekir")

  await page.getByRole("table").getByRole("button", { name: "Toplam: sırala", exact: true }).click()
  await page.getByRole("radio", { name: "Büyükten küçüğe", exact: true }).click()
  await expect(page).toHaveURL(/sort=total/)
  await expect(page).toHaveURL(/dir=desc/)
  await page.keyboard.press("Escape")
  await expect(rows).toHaveCount(100)

  // Toplam kolonu: İş No, Araç, Müşteri, Durum, Ödeme, Fatura, Toplam → 7. hücre.
  const readTotals = async () => (await rows.locator("td:nth-child(7)").allTextContents()).map(parseTotal)
  const assertDescendingNullsLast = (totals: (number | null)[]) => {
    const firstEmpty = totals.findIndex((value) => value === null)
    const priced = firstEmpty === -1 ? totals : totals.slice(0, firstEmpty)
    expect(totals.slice(priced.length).every((value) => value === null)).toBe(true)
    for (let i = 1; i < priced.length; i++) expect(priced[i]!).toBeLessThanOrEqual(priced[i - 1]!)
  }
  assertDescendingNullsLast(await readTotals())

  await loadMore.click()
  // Toplam kayıt 200'den azsa ikinci pencere hepsini getirir.
  await expect.poll(() => rows.count()).toBeGreaterThan(100)
  // Sıra, yüklenen ikinci pencerede de kesintisiz sürer (kararlı bağlayıcı).
  assertDescendingNullsLast(await readTotals())
  await expect(page).toHaveURL(/sort=total/)
  await expect(page).toHaveURL(/limit=200/)

  // Yön değişince liste baştan başlar (limit düşer).
  await page.getByRole("table").getByRole("button", { name: /^Toplam — Büyükten küçüğe/ }).click()
  await page.getByRole("radio", { name: "Küçükten büyüğe", exact: true }).click()
  await expect(page).toHaveURL(/dir=asc/)
  await expect(page).not.toHaveURL(/limit=/)
  await expect(rows).toHaveCount(100)
})

test("Daha fazla yükle grows the mobile list and keeps the filter", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto("/api/auth/dev-login?redirect=/orders")
  const loadMore = page.getByRole("button", { name: "Daha fazla yükle", exact: true })
  const items = page.getByLabel("Araç kabul sonuçları", { exact: true }).locator("ul > li")
  await expect(items.first()).toBeVisible()
  test.skip(!(await loadMore.isVisible()), "100'den fazla araç kabulü gerekir")
  await expect(items).toHaveCount(100)
  await loadMore.click()
  await expect(page).toHaveURL(/limit=200/)
  await expect.poll(() => items.count()).toBeGreaterThan(100)
})

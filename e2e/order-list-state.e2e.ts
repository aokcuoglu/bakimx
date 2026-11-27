import { expect, test } from "@playwright/test"

for (const width of [390, 1440]) {
  test(`order list preserves filters on detail return at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/api/auth/dev-login?redirect=/orders")
    await page.getByRole("textbox", { name: "Araç kabulü ara", exact: true }).fill("34")
    await page.getByRole("textbox", { name: "Araç kabulü ara", exact: true }).press("Enter")
    // Filtreler varsayılan kapalı (#800); açılınca seçimler erişilir.
    await page.getByRole("button", { name: "Filtreler", exact: false }).click()
    await page.getByRole("combobox", { name: "Tüm Ödemeler", exact: true }).click()
    await page.getByRole("option", { name: "Ödenmedi", exact: true }).click()
    await expect(page).toHaveURL(/payment=unpaid/)
    if (width === 1440) {
      await page.getByRole("button", { name: "Kolonlar", exact: true }).click()
      await page.getByRole("menuitemcheckbox", { name: "Tahmini teslim", exact: true }).click()
      await page.keyboard.press("Escape")
      // Sıralama sunucuda: adres `sort`/`dir` taşır, kolon araması yok (#831).
      await page.getByRole("table").getByRole("button", { name: "Toplam: sırala", exact: true }).click()
      await page.getByRole("radio", { name: "Büyükten küçüğe", exact: true }).click()
      await expect(page).toHaveURL(/sort=total/)
      await expect(page).toHaveURL(/dir=desc/)
      await page.keyboard.press("Escape")
    }
    const tableView = new URL(page.url()).searchParams.get("view")
    await page.getByRole("combobox", { name: "Tüm Durumlar", exact: true }).click()
    await page.getByRole("option", { name: "Aktif", exact: true }).click()
    await expect(page).toHaveURL(/status=active/)
    expect(new URL(page.url()).searchParams.get("view")).toBe(tableView)
    const listUrl = page.url()
    await page.locator('a[href^="/orders/"][href*="returnTo="]:visible').first().click()
    // Detay başlığındaki geri bağlantı, filtreli liste adresine (`/orders?…`) döner.
    const backLink = page.locator('a[href^="/orders?"]:visible', { hasText: "Araç Kabulleri" }).first()
    await expect(backLink).toBeVisible()
    // Reload the detail to prove this does not depend on an in-memory cache.
    await page.reload()
    await backLink.click()
    await expect(page).toHaveURL(listUrl)
    await expect(page.getByRole("textbox", { name: "Araç kabulü ara", exact: true })).toHaveValue("34")
    // Filtre paneli yeniden mount olunca kapalı açılır; seçili değer yine de korunur.
    await page.getByRole("button", { name: "Filtreler", exact: false }).click()
    await expect(page.getByRole("combobox", { name: /Tüm Ödemeler|Ödenmedi/ })).toContainText("Ödenmedi")
    if (width === 1440) {
      await expect(page.getByRole("columnheader", { name: /^Tahmini teslim/ })).toBeVisible()
      // Sunucu sıralaması geri dönüşte korunur.
      await expect(page.getByRole("table").getByRole("button", { name: /^Toplam — Büyükten küçüğe/ })).toBeVisible()
    }
    await page.goBack()
    await expect(backLink).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(listUrl)
    await page.getByRole("button", { name: "Filtreler", exact: false }).click()
    await page.getByRole("link", { name: "Temizle", exact: true }).click()
    await expect(page).toHaveURL(/\/orders$/)
    await expect(page.getByRole("textbox", { name: "Araç kabulü ara", exact: true })).toHaveValue("")
    await expect(page.getByRole("combobox", { name: /Tüm Ödemeler|Ödenmedi/ })).toContainText("Tüm Ödemeler")
    await page.goBack()
    await expect(page).toHaveURL(listUrl)
    await expect(page.getByRole("combobox", { name: /Tüm Ödemeler|Ödenmedi/ })).toContainText("Ödenmedi")
  })
}

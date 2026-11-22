import { expect, test } from "@playwright/test"

// Real registration creates isolated QA accounts; never run against a shared DB.
test.skip(process.env.LITE_ACQUISITION_E2E !== "true", "Opt in with the isolated Lite QA database")
test.beforeAll(() => {
  const database = new URL(process.env.DATABASE_URL || "postgresql://localhost/missing")
  expect(["localhost", "127.0.0.1"]).toContain(database.hostname)
  expect(database.port).toBe("55432")
  expect(database.pathname).toBe("/bakimx_lite_626")
})

for (const viewport of [{ width: 1440, height: 900 }, { width: 360, height: 800 }]) {
  test(`Lite acquisition navigation ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: "reduce" })
    // #781: ana sayfa hero'su artık Lite teklifi göstermiyor (tek paket, #782); akış fiyat sayfasından başlar.
    await page.goto("/fiyatlar?utm_source=facebook&utm_medium=paid_social&utm_campaign=lite_launch#lite")
    await expect(page).toHaveURL(/\/fiyatlar/)
    const signup = page.getByRole("link", { name: "Ücretsiz hesap oluştur", exact: true }).filter({ visible: true })
    await expect(signup).toBeVisible()
    await expect(page.getByText("0 TL/ay", { exact: true }).filter({ visible: true })).toBeVisible()
    await expect(page.locator("s")).toHaveCount(0)
    await page.getByRole("radio", { name: "Yıllık", exact: true }).click()
    await expect(page.getByText("0 TL/ay", { exact: true }).filter({ visible: true })).toBeVisible()
    await expect(signup).toHaveAttribute("href", "/register?tier=lite&cycle=yearly")
    await expect(page.getByRole("radio", { name: "Yıllık", exact: true })).toBeChecked()
    await page.screenshot({ path: `/private/tmp/lite-626-pricing-${viewport.width}.png`, fullPage: false, animations: "disabled" })
    await signup.click()
    await expect(page).toHaveURL(/tier=lite/)
    await expect(page.getByRole("heading", { name: "Hesap bilgileriniz" })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.getByLabel("Firma / servis adı *", { exact: true }).fill(`QA Lite ${viewport.width}`)
    await page.getByLabel("Cep telefonu *", { exact: true }).fill("05550000026")
    await page.getByLabel("E-posta *", { exact: true }).fill(`lite-ui-${viewport.width}-${Date.now()}@example.test`)
    await page.getByRole("combobox", { name: "İl *", exact: true }).click()
    await page.getByRole("option", { name: "İstanbul", exact: true }).click()
    await page.getByLabel("Açık adres *", { exact: true }).fill("QA test adresi")
    await page.getByLabel("Ad *", { exact: true }).fill("QA")
    await page.getByLabel("Soyad *", { exact: true }).fill("Lite")
    await page.getByLabel("Şifre *", { exact: true }).fill("QaLite626Test!")
    await page.getByLabel("Şifre tekrar *", { exact: true }).fill("QaLite626Test!")
    await page.getByRole("checkbox", { name: "Aydınlatma metni onayı" }).check()
    const registration = page.waitForResponse(response => response.url().endsWith("/api/auth/register") && response.request().method() === "POST")
    await page.getByRole("button", { name: "Ücretsiz Hesabımı Oluştur", exact: true }).click()
    const response = await registration
    expect(response.status()).toBe(200)
    expect(response.request().postDataJSON().planTier).toBe("lite")
    expect(response.request().postDataJSON().marketingAttribution.campaignSource).toBe("facebook")
    expect(await response.json()).toMatchObject({ ok: true })
    await expect(page.getByText(/süresiz ücretsiz Lite kullanımınız başlar/)).toBeVisible()
    await expect.poll(() => page.getByRole("heading", { name: "E-postanızı kontrol edin" }).evaluate(element => {
      for (let node: Element | null = element; node; node = node.parentElement) {
        if (Number(getComputedStyle(node).opacity) < 0.99) return false
      }
      return true
    })).toBe(true)
    await page.screenshot({ path: `/private/tmp/lite-626-register-${viewport.width}.png`, fullPage: false })
    if (viewport.width === 1440) {
      await page.setViewportSize({ width: 360, height: 800 })
      await page.screenshot({ path: "/private/tmp/lite-626-register-success-mobile.png", animations: "disabled" })
    }
  })
}

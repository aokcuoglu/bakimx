import { expect, test } from "@playwright/test"

for (const width of [320, 390, 768, 1000, 1440]) {
  test(`blog hero typography and overflow at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/blog")
    await page.evaluate(() => document.fonts.ready)
    const heading = page.getByRole("heading", { level: 1 })
    await expect(heading).toHaveCSS("font-weight", "600")
    await expect(heading).toHaveCSS("max-width", "796px")
    if (width >= 1000) {
      await expect(heading).toHaveCSS("font-size", "62px")
      await expect(heading).toHaveCSS("line-height", "68.2px")
      await expect(heading).toHaveCSS("letter-spacing", "-0.62px")
    }
    await page.screenshot({ path: testInfo.outputPath("blog.png") })
    expect(await heading.evaluate((el) => getComputedStyle(el).fontFamily)).toContain("blogFont")
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}

for (const width of [320, 390, 768, 1440]) {
  for (const tier of ["lite", "pro"]) {
    test(`registration verification preserves ${tier} terms at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: "reduce" })
      let submissions = 0
      await page.route("**/api/auth/register", async (route) => {
        submissions++
        expect(route.request().postDataJSON()).toMatchObject({ planTier: tier, kvkkConsent: true })
        await route.fulfill({ json: submissions === 1 ? { ok: false, error: "QA geçici hata" } : { ok: true } })
      })
      await page.goto(`/register?tier=${tier}`)
      await page.getByRole("button", { name: "Reddet", exact: true }).click()
      await page.getByLabel("Firma / servis adı *", { exact: true }).fill("QA Tasarım Servisi")
      await page.getByLabel("Cep telefonu *", { exact: true }).fill("05551234567")
      const email = "qa.design.verification@example.test"
      await page.getByLabel("E-posta *", { exact: true }).fill(email)
      await page.getByPlaceholder("İl seçin", { exact: true }).fill("İstanbul")
      await page.getByRole("option", { name: "İstanbul", exact: true }).click()
      await page.getByLabel("Açık adres *", { exact: true }).fill("QA Mahallesi Test Sokak No 1")
      await page.getByLabel("Ad *", { exact: true }).fill("Tasarım")
      await page.getByLabel("Soyad *", { exact: true }).fill("Kontrol")
      await page.getByLabel("Şifre *", { exact: true }).fill("TestDesign123!")
      await page.getByLabel("Şifre tekrar *", { exact: true }).fill("TestDesign123!")
      await page.getByRole("checkbox", { name: "Aydınlatma metni onayı" }).check()
      const submit = page.getByRole("button", { name: "Ücretsiz Hesabımı Oluştur" })
      await submit.click()
      await expect(page.getByRole("main", { name: "Hesap kayıt formu" }).getByRole("alert")).toContainText("QA geçici hata")
      await expect(page.getByLabel("E-posta *", { exact: true })).toHaveValue(email)
      await submit.click()
      const confirmation = page.getByRole("region", { name: "E-postanızı kontrol edin" })
      await expect(confirmation).toBeVisible()
      await expect(confirmation).toContainText(email)
      await expect(confirmation).toContainText(tier === "lite" ? "süresiz ücretsiz Lite" : "ücretsiz 7 iş günlük")
      await expect(confirmation.getByRole("heading")).toHaveCSS("font-size", width < 640 ? "28px" : "32px")
      const back = confirmation.getByRole("link", { name: "Giriş sayfasına dön" })
      await expect(back).toHaveAttribute("href", "/login")
      await back.focus()
      await page.keyboard.press("Shift+Tab")
      await page.keyboard.press("Tab")
      await expect(back).toBeFocused()
      await page.screenshot({ path: testInfo.outputPath("verification.png") })
      expect(submissions).toBe(2)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    })
  }
}

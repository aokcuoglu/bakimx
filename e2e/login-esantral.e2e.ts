import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

/** #796 — /login ana sayfanın e-santral tasarım diliyle; giriş davranışı aynı. */

for (const [width, height] of [[1440, 900], [390, 844]] as const) {
  test(`giriş kartı, taşma ve erişilebilirlik ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto("/login")
    await expect(page.getByRole("heading", { level: 1, name: "Giriş yap" })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    const violations = (await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations
    expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([])
  })
}

test("kullanıcı adı yazınca iş yeri kodu açılır, şifre göster çalışır, hata kartta görünür", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: false, error: "E-posta veya şifre hatalı." }) }),
  )
  await page.goto("/login")
  const identifier = page.getByLabel("E-posta veya kullanıcı adı", { exact: true })
  await identifier.fill("usta")
  await expect(page.getByLabel("İş yeri kodu", { exact: true })).toBeVisible()
  await identifier.fill("usta@example.com")
  await expect(page.getByLabel("İş yeri kodu", { exact: true })).toHaveCount(0)

  const password = page.getByLabel("Şifre", { exact: true })
  await password.fill("yanlis-sifre")
  await page.getByRole("button", { name: "Göster", exact: true }).click()
  await expect(password).toHaveAttribute("type", "text")

  await page.getByRole("button", { name: "Giriş yap", exact: true }).click()
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("E-posta veya şifre hatalı.")
  await expect(page).toHaveURL(/\/login/)
})

test("oturum sona erdi bildirimi ve ana sayfa bağlantıları", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/login?expired=trial_expired")
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible()
  await expect(page.getByRole("banner").getByRole("link", { name: "Fiyat", exact: true })).toHaveAttribute("href", "/#fiyat")
  await expect(page.getByRole("link", { name: "Şifremi unuttum ›", exact: true })).toHaveAttribute("href", "/forgot-password")
})

test("Ücretsiz deneyin giriş sayfasında da kayıt penceresini açar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/login")
  await page.getByRole("main").getByRole("link", { name: "Ücretsiz deneyin ›", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "BakımX'i ücretsiz deneyin" })).toBeVisible()
})

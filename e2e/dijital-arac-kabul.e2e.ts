import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test("dijital araç kabul sayfası mobilde taşmadan ve erişilebilir açılır", async ({ page }) => {
  await page.goto("/dijital-arac-kabul")

  await expect(page).toHaveTitle(/Dijital Araç Kabul: Ruhsat, Fotoğraf ve Hasar Kaydı Tek Ekranda/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://bakimx.com/dijital-arac-kabul")
  await expect(page.getByRole("heading", { level: 1, name: /Dijital araç kabul/ })).toBeVisible()
  await expect(page.getByRole("link", { name: "Ücretsiz deneyin" })).toHaveCount(2)

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, "360 px görünümde yatay taşma").toBeLessThanOrEqual(1)

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()
  expect(results.violations).toEqual([])
})

test("ana CTA klavyeyle odaklanabilir", async ({ page }) => {
  await page.goto("/dijital-arac-kabul")
  const primaryCtas = page.getByRole("link", { name: "Ücretsiz deneyin" })

  await primaryCtas.first().focus()
  await expect(primaryCtas.first()).toBeFocused()
})

test("kategori merkezine, iş emri sayfasına ve araç kabul rehberine iç bağlantı var", async ({ page }) => {
  await page.goto("/dijital-arac-kabul")
  const detaySection = page.locator("section", { has: page.locator("#detay-baslik") })

  await expect(detaySection.getByRole("link", { name: "Oto servis programı" })).toHaveAttribute("href", "/oto-servis-programi")
  await expect(detaySection.getByRole("link", { name: "İş emri programı" })).toHaveAttribute("href", "/is-emri-programi")
  await expect(detaySection.getByRole("link", { name: "Araç kabul rehberi" })).toHaveAttribute("href", "/rehber/arac-kabul-formu")
})

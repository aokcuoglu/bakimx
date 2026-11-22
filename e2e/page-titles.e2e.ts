import { expect, test } from "@playwright/test"
import { existsSync } from "node:fs"

// Blog/contact content is delivered separately; these checks also run in that working tree.
const hasBlog = existsSync("src/app/(site)/blog/page.tsx")
const hasContact = existsSync("src/app/(site)/contact-us/page.tsx")

const publicPages: [string, string][] = [
  ["/", "BakımX: Oto Servis Yönetim Platformu"],
  ["/blog", "BakımX Blog: Servis Yönetimi ve Rehberler"],
  ["/contact-us", "İletişim | BakımX"],
  ["/demo", "Canlı Demo Talebi | BakımX"],
  ["/fiyatlar", "Oto Servis Programı Fiyatları | BakımX"],
  ["/oto-servis-programi", "Oto Servis Programı: Araç Kabulden Teslimata | BakımX"],
  ["/is-emri-programi", "İş Emri Programı: İş ve Onay Takibi | BakımX"],
  ["/dijital-arac-kabul", "Dijital Araç Kabul: Ruhsat, Fotoğraf ve Hasar Kaydı | BakımX"],
  ["/rehber/arac-kabul-formu", "Araç Kabul Formu: 8 Adımlık Kontrol Listesi | BakımX"],
  ["/rehber/oto-servis-is-emri-nasil-hazirlanir", "Oto Servis İş Emri Nasıl Hazırlanır? | BakımX"],
  ["/karsilastir/defter-excel-oto-servis-programi", "Defter, Excel ve Oto Servis Programı Karşılaştırması | BakımX"],
  ["/status", "Sistem Durumu | BakımX"],
  ["/privacy", "Gizlilik Politikası | BakımX"],
  ["/terms", "Kullanım Koşulları | BakımX"],
  ["/kvkk", "KVKK Aydınlatma Metni | BakımX"],
  ["/acik-riza", "Açık Rıza Metni | BakımX"],
  ["/login", "Giriş Yap | BakımX"],
  ["/register", "Ücretsiz Hesap Oluştur | BakımX"],
  ["/forgot-password", "Şifremi Unuttum | BakımX"],
]

for (const [url, title] of publicPages) {
  test(`${url}: browser title`, async ({ page }) => {
    test.skip((url === "/blog" && !hasBlog) || (url === "/contact-us" && !hasContact), "Content page is not present in this checkout")
    await page.goto(url)
    await expect(page).toHaveTitle(title)
    await expect(page.locator("title")).toHaveCount(1)
  })
}

test("client navigation and browser back update the tab title", async ({ page }) => {
  test.skip(!hasBlog, "Blog content is not present in this checkout")
  await page.goto("/blog")
  const article = page.locator('main a[href^="/blog/"]').first()
  await article.click()
  await expect(page).not.toHaveTitle("BakımX Blog: Servis Yönetimi ve Rehberler")
  await expect(page).toHaveTitle(/ \| BakımX$/)
  await page.goBack()
  await expect(page).toHaveTitle("BakımX Blog: Servis Yönetimi ve Rehberler")
})

test("authenticated nested pages retain the root brand template", async ({ page }) => {
  await page.goto("/api/auth/dev-login?email=admin@bakimx.com&redirect=/dashboard")
  await expect(page).toHaveTitle("Genel Bakış | BakımX")
  for (const [url, title] of [
    ["/orders", "İş Emirleri"], ["/customers", "Müşteriler"],
    ["/vehicles/new", "Yeni Araç"], ["/settings/notifications", "Bildirim Ayarları"],
    ["/admin", "Genel Bakış · Yönetim"], ["/admin/catalog", "Ürün Kataloğu · Yönetim"],
    ["/admin/live-chat/settings", "Canlı Destek Ayarları · Yönetim"],
  ]) {
    await page.goto(url)
    await expect(page).toHaveTitle(`${title} | BakımX`)
  }
  await page.goto("/inventory")
  await expect(page).toHaveURL(/\/parts$/)
  await expect(page).toHaveTitle("Stok ve Hizmetler | BakımX")
})

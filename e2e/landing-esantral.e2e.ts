import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

/**
 * #781 — ana sayfa e-santral.com/bakimx düzeninde. Birim testleri sunucu
 * HTML'ini ve kaynak sözleşmelerini kapsar; burada tarayıcıda görülen
 * davranış var: taşma, hero yerleşimi, "Sizi arayalım" penceresi (klavye, hata,
 * hız sınırı), kart rayı ve koyu temada açık kalan pazarlama yüzeyi.
 */

/** HeroFit hero'ya --text yazınca sayfa hidrasyonu tamamlanmıştır. */
async function openHome(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/")
  await expect(page.locator("#hero")).toHaveAttribute("style", /--text/)
}

const overflowX = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

for (const [width, height] of [[1440, 900], [390, 844], [375, 667], [844, 390]] as const) {
  test(`bölümler, taşma ve hero yerleşimi ${width}x${height}`, async ({ page }) => {
    await openHome(page, width, height)
    for (const id of ["hero", "nasil", "ozellikler", "gecis", "fiyat", "sorular"]) {
      await expect(page.locator(`#${id}`)).toHaveCount(1)
    }
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
    expect(await overflowX(page)).toBeLessThanOrEqual(0)

    const title = await page.getByRole("heading", { level: 1 }).boundingBox()
    const phone = await page.locator("#hero").getByRole("img", { name: /uygulama ekranı/ }).boundingBox()
    expect(title).not.toBeNull()
    expect(phone).not.toBeNull()
    expect(title!.y + title!.height).toBeLessThanOrEqual(phone!.y)
  })
}

test("hero ve üst bant CTA'ları e-santral hap ölçüsünde, kayda gider", async ({ page }) => {
  await openHome(page, 1440, 900)
  const hero = page.locator("#hero").getByRole("link", { name: "Ücretsiz deneyin", exact: true })
  await expect(hero).toHaveAttribute("href", "/register")
  await expect(hero).toHaveCSS("height", "44px")
  await expect(hero).toHaveCSS("font-size", "17px")
  await expect(hero).toHaveCSS("background-color", "rgb(0, 113, 227)")
  await expect(hero).toHaveCSS("color", "rgb(255, 255, 255)")
  const header = page.getByRole("banner").getByRole("link", { name: "Ücretsiz deneyin", exact: true })
  await expect(header).toHaveAttribute("href", "/register")
  await expect(header).toHaveCSS("font-size", "15px")
  await expect(page.getByRole("banner").getByRole("link", { name: "Giriş yap", exact: true })).toHaveAttribute("href", "/login")
})

test("Sizi arayalım: klavye, doğrulama ve başarılı gönderim", async ({ page }) => {
  await openHome(page, 1440, 900)
  const requests: unknown[] = []
  await page.route("**/api/demo-request", async (route) => {
    requests.push(route.request().postDataJSON())
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) })
  })

  const trigger = page.locator("#hero").getByRole("link", { name: "Sizi arayalım ›", exact: true })
  await trigger.click()
  const dialog = page.getByRole("dialog", { name: "Sizi arayalım" })
  await expect(dialog).toBeVisible()
  const name = dialog.getByLabel("Ad soyad", { exact: true })
  await expect(name).toBeFocused()

  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()

  await trigger.click()
  await dialog.getByRole("button", { name: "Beni arayın", exact: true }).click()
  await expect(dialog.getByRole("alert")).toHaveText("Adınızı ve soyadınızı yazın.")
  await expect(name).toHaveAttribute("aria-invalid", "true")
  expect(requests).toHaveLength(0)

  await name.fill("Deneme Kullanıcı")
  const phone = dialog.getByLabel("Cep telefonu", { exact: true })
  await phone.fill("+90 532 123 45 67")
  await expect(phone).toHaveValue("0532 123 45 67")
  await dialog.getByRole("checkbox").click()
  await dialog.getByRole("button", { name: "Beni arayın", exact: true }).click()
  await expect(dialog.getByRole("heading", { name: "Teşekkürler." })).toBeVisible()
  expect(requests).toHaveLength(1)
  expect(requests[0]).toMatchObject({ source: "landing_callback", name: "Deneme Kullanıcı", phone: "0532 123 45 67" })
  // Reklam onayı verilmeden kampanya bilgisi sunucuda saklanmaz (route sözleşmesi).
  expect(requests[0]).toHaveProperty("targetingConsent", false)
  await dialog.getByRole("button", { name: "Tamam", exact: true }).click()
  await expect(dialog).toHaveCount(0)
})

test("Sizi arayalım: hız sınırında pencere açık kalır, değerler korunur", async ({ page }) => {
  await openHome(page, 390, 844)
  await page.route("**/api/demo-request", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ success: false, errors: { _general: "Çok fazla istek. Lütfen biraz bekleyin." } }),
    }),
  )
  await page.locator("#gecis").getByRole("link", { name: "Sizi arayalım", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Sizi arayalım" })
  await dialog.getByLabel("Ad soyad", { exact: true }).fill("Deneme Kullanıcı")
  await dialog.getByLabel("Cep telefonu", { exact: true }).fill("05321234567")
  await dialog.getByRole("checkbox").click()
  const submit = dialog.getByRole("button", { name: "Beni arayın", exact: true })
  await submit.click()
  await expect(dialog.getByRole("alert")).toHaveText("Çok fazla istek. Lütfen biraz bekleyin.")
  await expect(dialog.getByLabel("Ad soyad", { exact: true })).toHaveValue("Deneme Kullanıcı")
  await expect(submit).toBeEnabled()

  // Telefonda alttan açılan sheet: ekranın altına yaslı, yatay taşma yok.
  const box = await dialog.boundingBox()
  expect(Math.round(box!.x)).toBe(0)
  expect(Math.round(box!.y + box!.height)).toBe(844)
  await submit.scrollIntoViewIfNeeded()
  await expect(submit).toBeInViewport()
})

test("kart rayı ok düğmeleriyle kayar", async ({ page }) => {
  await openHome(page, 1440, 900)
  const previous = page.getByRole("button", { name: "Önceki kart" })
  const next = page.getByRole("button", { name: "Sonraki kart" })
  await expect(previous).toBeDisabled()
  const rail = page.getByRole("region", { name: /dükkanınızda bir gün/ })
  await expect(rail).toHaveCount(1)
  await next.click()
  await expect.poll(() => rail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
  await expect(previous).toBeEnabled()
})

test("koyu tema tercihinde pazarlama yüzeyi açık kalır", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await openHome(page, 1440, 900)
  await page.evaluate(() => document.documentElement.classList.add("dark"))
  const page_ = page.locator("main").locator("..")
  await expect(page_).toHaveCSS("background-color", "rgb(255, 255, 255)")
  await expect(page.locator("#fiyat").getByText("₺1.499")).toHaveCSS("color", "rgb(29, 29, 31)")
})

test("site asistanı balonu hero CTA'larıyla çakışmaz (390px)", async ({ page }) => {
  await openHome(page, 390, 844)
  const launcher = page.getByRole("button", { name: "BakımX Asistanı'nı aç" })
  await expect(launcher).toBeVisible()
  const bubble = await launcher.boundingBox()
  for (const cta of [
    page.locator("#hero").getByRole("link", { name: "Ücretsiz deneyin", exact: true }),
    page.locator("#hero").getByRole("link", { name: "Sizi arayalım ›", exact: true }),
  ]) {
    const box = await cta.boundingBox()
    const overlaps =
      bubble!.x < box!.x + box!.width && bubble!.x + bubble!.width > box!.x &&
      bubble!.y < box!.y + box!.height && bubble!.y + bubble!.height > box!.y
    expect(overlaps).toBe(false)
  }
})

test("ana sayfa ve Sizi arayalım penceresi WCAG AA taramasından geçer", async ({ page }) => {
  const scan = async (selector: string) =>
    (await new AxeBuilder({ page }).include(selector).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations.map(
      ({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }),
    )
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    await openHome(page, width, height)
    expect(await scan("main"), `main ${width}`).toEqual([])
    expect(await scan("footer"), `footer ${width}`).toEqual([])
  }
  await page.locator("#hero").getByRole("link", { name: "Sizi arayalım ›", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Sizi arayalım" })).toBeVisible()
  expect(await scan('[role="dialog"]')).toEqual([])
})

test("Ücretsiz deneyin: kayıt penceresi doğrular, hızlı kayıt gönderir, e-posta doğrulamasına yönlendirir (#783)", async ({ page }) => {
  await openHome(page, 1440, 900)
  const bodies: Record<string, unknown>[] = []
  await page.route("**/api/auth/register", async (route) => {
    bodies.push(route.request().postDataJSON())
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) })
  })

  const trigger = page.locator("#hero").getByRole("link", { name: "Ücretsiz deneyin", exact: true })
  await trigger.click()
  const dialog = page.getByRole("dialog", { name: "BakımX'i ücretsiz deneyin" })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel("Dükkân adı", { exact: true })).toBeFocused()

  await dialog.getByRole("button", { name: "Hesabımı oluştur", exact: true }).click()
  await expect(dialog.getByRole("alert")).toHaveText("Dükkân adını yazın.")
  expect(bodies).toHaveLength(0)

  await dialog.getByLabel("Dükkân adı", { exact: true }).fill("Yıldız Oto")
  await dialog.getByLabel("Ad soyad", { exact: true }).fill("Ayşe Nur Yılmaz")
  await dialog.getByLabel("Cep telefonu", { exact: true }).fill("05321234567")
  await dialog.getByLabel("E-posta", { exact: true }).fill("ayse@example.com")
  const password = dialog.getByLabel("Şifre", { exact: true })
  await password.fill("gizli-sifre")
  await expect(password).toHaveAttribute("type", "password")
  await dialog.getByRole("button", { name: "Göster", exact: true }).click()
  await expect(password).toHaveAttribute("type", "text")
  await dialog.getByRole("checkbox").click()
  await dialog.getByRole("button", { name: "Hesabımı oluştur", exact: true }).click()

  await expect(dialog.getByRole("heading", { name: "E-postanızı kontrol edin." })).toBeVisible()
  await expect(dialog).toContainText("ayse@example.com")
  expect(bodies).toHaveLength(1)
  expect(bodies[0]).toMatchObject({
    signupFlow: "quick",
    workshopName: "Yıldız Oto",
    firstName: "Ayşe Nur",
    lastName: "Yılmaz",
    phone: "0532 123 45 67",
    email: "ayse@example.com",
    kvkkConsent: true,
  })
  expect(bodies[0]).not.toHaveProperty("city")

  await dialog.getByRole("button", { name: "Tamam", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test("Ücretsiz deneyin: sunucu hatası pencerede kalır (e-posta kullanımda)", async ({ page }) => {
  await openHome(page, 390, 844)
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Bu e-posta adresi zaten kayıtlı." }) }),
  )
  await page.getByRole("banner").getByRole("link", { name: "Ücretsiz deneyin", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "BakımX'i ücretsiz deneyin" })
  await dialog.getByLabel("Dükkân adı", { exact: true }).fill("Yıldız Oto")
  await dialog.getByLabel("Ad soyad", { exact: true }).fill("Ali Veli")
  await dialog.getByLabel("Cep telefonu", { exact: true }).fill("05321234567")
  await dialog.getByLabel("E-posta", { exact: true }).fill("ali@example.com")
  await dialog.getByLabel("Şifre", { exact: true }).fill("gizli-sifre")
  await dialog.getByRole("checkbox").click()
  await dialog.getByRole("button", { name: "Hesabımı oluştur", exact: true }).click()
  await expect(dialog.getByRole("alert")).toHaveText("Bu e-posta adresi zaten kayıtlı.")
  await expect(dialog.getByLabel("Dükkân adı", { exact: true })).toHaveValue("Yıldız Oto")
  const box = await dialog.boundingBox()
  expect(Math.round(box!.x)).toBe(0)
  expect(Math.round(box!.y + box!.height)).toBe(844)
})

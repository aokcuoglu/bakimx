import { expect, test } from "@playwright/test"

test("genel kayıt sihirbazı açık danışman dizini göstermiyor", async ({ page }) => {
  await page.goto("/register")

  await expect(page.getByRole("heading", { level: 1, name: "Hesap bilgileriniz" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Sektörünüzü seçin" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Devam Et" })).toHaveCount(0)
  await expect(page.getByText("Bizi nereden duydunuz?")).toBeVisible()
  await expect(page.getByText("Temsilci seçin")).toHaveCount(0)
})

test("genel kayıt API'si ham danışman kimliğini reddediyor", async ({ request }) => {
  const response = await request.post("/api/auth/register", {
    data: { acquisitionAdvisorId: "forged-advisor-id" },
  })

  expect(response.status()).toBe(400)
  expect(await response.json()).toEqual({
    error: "Satış danışmanı atfı yalnız güvenli kayıt bağlantısıyla yapılabilir.",
  })
})

test("hesap bilgileri kurulum seçimi yapmadan gönderilir", async ({ page }) => {
  let payload: Record<string, unknown> | undefined
  await page.route("**/api/auth/register", async route => {
    payload = route.request().postDataJSON()
    await route.fulfill({ json: { ok: true } })
  })
  await page.goto("/register")
  await page.getByLabel("Firma / servis adı *", { exact: true }).fill("Test Servis")
  await page.getByLabel("Cep telefonu *", { exact: true }).fill("05550000026")
  await page.getByLabel("E-posta *", { exact: true }).fill("register-test@example.test")
  await page.getByRole("combobox", { name: "İl *", exact: true }).click()
  await page.getByRole("option", { name: "İstanbul", exact: true }).click()
  await page.getByLabel("Açık adres *", { exact: true }).fill("Test adresi")
  await page.getByLabel("Ad *", { exact: true }).fill("Test")
  await page.getByLabel("Soyad *", { exact: true }).fill("Kullanıcı")
  await page.getByLabel("Şifre *", { exact: true }).fill("TestPassword123!")
  await page.getByLabel("Şifre tekrar *", { exact: true }).fill("TestPassword123!")
  await page.getByRole("checkbox", { name: "Aydınlatma metni onayı" }).check()
  await page.getByRole("button", { name: "Reddet", exact: true }).click()
  await page.getByRole("button", { name: "Ücretsiz Hesabımı Oluştur", exact: true }).click()
  await expect(page.getByRole("heading", { name: "E-postanızı kontrol edin" })).toBeVisible()
  expect(payload?.workshopName).toBe("Test Servis")
  for (const key of ["sector", "businessFeatures", "teamSize", "selectedModules", "setupPreference"]) {
    expect(payload).not.toHaveProperty(key)
  }
})

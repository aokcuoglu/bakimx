import { expect, test } from "@playwright/test"

test("genel kayıt sihirbazı açık danışman dizini göstermiyor", async ({ page }) => {
  await page.goto("/register")

  await expect(page.getByRole("heading", { level: 1, name: "Sektörünüzü seçin" })).toBeVisible()
  await page.getByRole("radio", { name: /Oto Servis/ }).click()
  await page.getByRole("button", { name: "Devam Et" }).click()
  await page.getByRole("button", { name: "Devam Et" }).click()
  await page.getByRole("radio", { name: /Sadece Ben/ }).click()
  await page.getByRole("button", { name: "Devam Et" }).click()
  await page.getByRole("button", { name: "Devam Et" }).click()

  await expect(page.getByRole("heading", { level: 1, name: "Hesap bilgileriniz" })).toBeVisible()
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

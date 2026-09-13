import { expect, test } from "@playwright/test"

test("contact form validates input, preserves failed submissions and confirms success", async ({ page }) => {
  await page.goto("/contact-us")
  const submit = page.getByRole("button", { name: "Gönder", exact: true })
  await submit.click()
  await expect(page.getByText("Ad Soyad en az 2 karakter olmalıdır")).toBeVisible()
  await page.getByLabel("Ad Soyad", { exact: true }).fill("Test Kullanıcı")
  await page.getByLabel("E-posta", { exact: true }).fill("qa@example.com")
  await page.getByLabel("Telefon", { exact: true }).fill("05321234567")
  await page.getByLabel("Ünvan", { exact: true }).fill("Servis sahibi")
  await page.getByLabel("Şirket / Servis adı", { exact: true }).fill("QA Servis")
  await page.getByLabel("Bizi nasıl duydunuz?", { exact: true }).fill("Tavsiye")
  await page.getByLabel("Mesajınız", { exact: true }).fill("Bu bir otomatik test mesajıdır.")
  let requests = 0
  await page.route("**/api/support-request", async (route) => {
    requests++
    expect(route.request().postDataJSON()).toMatchObject({
      email: "qa@example.com", businessName: "QA Servis", subject: "Servis sahibi · Tavsiye",
    })
    await route.fulfill({ status: requests === 1 ? 503 : 200, contentType: "application/json",
      body: JSON.stringify(requests === 1 ? { errors: { _general: "Tekrar deneyin." } } : { success: true }),
    })
  })
  await submit.click()
  await expect(page.getByRole("alert")).toContainText("Tekrar deneyin.")
  await expect(page.getByLabel("Ad Soyad", { exact: true })).toHaveValue("Test Kullanıcı")
  await submit.click()
  await expect(page.getByRole("alert")).toContainText("Mesajınız bize ulaştı.")
  expect(requests).toBe(2)
})

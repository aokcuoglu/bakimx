import { expect, test } from "@playwright/test"

const orderId = "cmtogl9fj000101adxjdnq3ao"

for (const width of [390, 1440]) {
  test(`order summary editors open in dialogs at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`/api/auth/dev-login?redirect=/orders/${orderId}`)
    await page.locator('[data-slot="card-title"]').filter({ hasText: "İş Emri Bilgileri" })
      .waitFor({ timeout: 10_000 }).catch(() => {})
    test.skip(await page.locator('[data-slot="card-title"]').filter({ hasText: "İş Emri Bilgileri" }).count() === 0,
      "The reference order is not present in this database")

    await page.getByRole("button", { name: "Fatura bilgilerini düzenle" }).click()
    const invoice = page.getByRole("dialog", { name: "Fatura bilgilerini düzenle" })
    await expect(invoice.getByLabel("Fatura Numarası")).toBeVisible()
    await invoice.getByRole("button", { name: "İptal" }).click()
    await expect(invoice).toBeHidden()

    await page.getByRole("button", { name: "Durumu düzenle" }).click()
    const status = page.getByRole("dialog", { name: "Durumu düzenle" })
    await expect(status.getByRole("combobox", { name: "Yeni durum" })).toBeVisible()
    await status.getByRole("button", { name: "İptal" }).click()
    await page.getByRole("button", { name: "Servise geliş nedenini düzenle" }).click()
    const reason = page.getByRole("dialog", { name: "Servise geliş nedenini düzenle" })
    await expect(reason.getByRole("combobox", { name: "Servise geliş nedeni" })).toBeVisible()
    await reason.getByRole("button", { name: "İptal" }).click()

    await page.getByRole("button", { name: "Şikayet ve notları düzenle" }).click()
    const intake = page.getByRole("dialog", { name: "Şikayet ve notları düzenle" })
    await expect(intake.getByPlaceholder("Müşterinin bildirdiği arıza/şikayet...")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(intake).toBeHidden()

    await page.getByRole("button", { name: /İndirim \/ KDV ekle|İndirim & KDV Düzenle/ }).click()
    const pricing = page.getByRole("dialog", { name: "İndirim ve KDV düzenle" })
    await expect(pricing.getByLabel("İndirim (₺)")).toBeVisible()
    await pricing.getByRole("button", { name: "İptal" }).click()
    await expect(pricing).toBeHidden()

    const addInfo = page.getByRole("button", { name: "Bilgi ekle" }).first()
    if (await addInfo.count()) {
      await addInfo.click()
      await expect(intake).toBeVisible()
      await intake.getByRole("button", { name: "İptal" }).click()
    }

    await page.goto(`/orders/${orderId}?edit=1`)
    await expect(page.getByRole("dialog", { name: "Şikayet ve notları düzenle" })).toBeVisible()
  })
}

test("item edits stay local until the dialog is saved", async ({ page }) => {
  const itemOrderId = "cmri8ldca002v9yxloej5ia6n"
  let patches = 0
  let savedBody = ""
  await page.route("**/api/orders/items?*", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue()
    patches += 1
    savedBody = route.request().postData() ?? ""
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' })
  })
  await page.goto(`/api/auth/dev-login?redirect=/orders/${itemOrderId}`)
  await page.getByRole("tab", { name: /Parça & İşçilik/ }).click()
  const edit = page.getByRole("button", { name: "Kalemi düzenle" }).first()
  await edit.waitFor({ timeout: 10_000 }).catch(() => {})
  test.skip(await edit.count() === 0, "An editable order item is required")

  await page.getByRole("button", { name: "Parça ekle" }).click()
  await expect(page.getByRole("dialog", { name: "Parça ekle" })).toBeVisible()
  await page.keyboard.press("Escape")

  await edit.click()
  const dialog = page.getByRole("dialog", { name: "Kalemi düzenle" })
  const quantity = dialog.getByRole("textbox", { name: /miktarı/ })
  await quantity.fill("2")
  await dialog.getByRole("button", { name: "İptal" }).click()
  expect(patches).toBe(0)

  await edit.click()
  await expect(quantity).toHaveValue("1")
  await quantity.fill("2")
  await dialog.getByRole("button", { name: "Kaydet" }).click()
  await expect(dialog).toBeHidden()
  expect(patches).toBe(1)
  expect(savedBody).toMatch(/name="quantity"\r?\n\r?\n2/)

  await edit.click()
  await dialog.getByRole("textbox", { name: "Birim fiyat" }).fill("150")
  await dialog.getByRole("button", { name: "Kaydet" }).click()
  await expect(dialog).toBeHidden()
  expect(patches).toBe(2)
  expect(savedBody).toMatch(/name="unitPrice"\r?\n\r?\n15000/)
})

import { expect, test } from "@playwright/test"

const orderId = "cmtogl9fj000101adxjdnq3ao"

for (const width of [390, 1440]) {
  test(`order summary editors open in dialogs at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`/api/auth/dev-login?redirect=/orders/${orderId}`)
    const orderInfo = page.getByRole("region", { name: "Araç Kabul Bilgileri" })
    await orderInfo.waitFor({ timeout: 10_000 }).catch(() => {})
    test.skip(await orderInfo.count() === 0,
      "The reference order is not present in this database")

    await page.getByRole("button", { name: "Fatura bilgilerini düzenle" }).click()
    const invoice = page.getByRole("dialog", { name: "Fatura bilgilerini düzenle" })
    await expect(invoice.getByLabel("Fatura Numarası")).toBeVisible()
    await invoice.getByRole("button", { name: "İptal" }).click()
    await expect(invoice).toBeHidden()

    await expect(orderInfo.getByRole("combobox", { name: "Durum" })).toBeVisible()
    await expect(orderInfo.getByRole("combobox", { name: "Servise geliş nedeni" })).toBeVisible()
    await orderInfo.getByRole("combobox", { name: "Durum" }).click()
    await expect(page.getByRole("listbox")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog", { name: "Durumu düzenle" })).toHaveCount(0)

    await page.getByRole("button", { name: "Şikayet ve notları düzenle" }).click()
    const intake = page.getByRole("dialog", { name: "Şikayet ve notları düzenle" })
    await expect(intake.getByPlaceholder("Müşterinin bildirdiği arıza/şikayet...")).toBeVisible()
    const save = intake.getByRole("button", { name: "Kaydet" })
    await expect(save).toBeInViewport()
    const header = intake.locator('[data-slot="dialog-header"]')
    const footer = intake.locator('[data-slot="dialog-footer"]')
    expect((await header.boundingBox())!.y).toBeLessThan((await footer.boundingBox())!.y)
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
  await page.setViewportSize({ width: 1440, height: 900 })
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

  await page.getByRole("button", { name: "İşçilik ekle" }).click()
  const labor = page.getByRole("dialog", { name: "İşçilik ekle" })
  const labels = ["İşçilik", "Miktar", "KDV", "Birim Fiyat"]
  const tops = await Promise.all(labels.map(async (label) => (await labor.getByText(label, { exact: true }).first().boundingBox())!.y))
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(6)
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

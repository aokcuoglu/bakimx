import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import { salesE2EPrisma as prisma } from "./helpers/sales-e2e-fixture"

test("faturalandırma özeti ve detaylar masaüstü ile mobilde erişilebilir kalır", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/api/auth/dev-login?redirect=/settings/billing")
  await expect(page).toHaveURL(/\/settings\/billing$/)

  const content = page.locator("[data-settings-content]")
  await expect(content.getByRole("link", { name: "Paketleri incele" })).toBeVisible()
  await expect(content.getByRole("heading", { name: "Kullanım" })).toHaveCount(1)
  await expect(content.getByRole("progressbar", { name: "Koltuk kullanımı" })).toBeVisible()
  await content.getByRole("button", { name: "Üyeleri yönet" }).click()
  const manage = page.getByRole("dialog", { name: "Paketi yönet" })
  await expect(manage).toBeVisible()
  await expect(page).toHaveURL(/\/settings\/billing$/)
  await page.keyboard.press("Escape")
  await expect(manage).toHaveCount(0)
  await expect(content.getByRole("heading", { name: "Fatura bilgileri" })).toBeVisible()
  await expect(content.getByRole("heading", { name: "Ödeme geçmişi" })).toBeVisible()
  await expect(content.getByRole("link", { name: "Fatura bilgilerini düzenle" })).toHaveAttribute("href", "/settings/general")

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(content.getByRole("heading", { name: "Ödeme geçmişi" })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test("bekleyen kart ödemesi aynı sayfada açılır", async ({ page }) => {
  const key = randomUUID().slice(0, 8)
  const email = `billing-pending-${key}@example.test`
  const reference = `BX-${key.toUpperCase()}`
  const workshop = await prisma.workshop.create({
    data: {
      loginCode: `bp-${key}`,
      name: "QA Bekleyen Ödeme",
      phone: "05550000000",
      city: "İstanbul",
      address: "QA adresi",
      approvalStatus: "approved",
      subscriptionStatus: "active",
      planTier: "pro",
      billingCycle: "monthly",
      currentPeriodEnd: new Date(Date.now() + 20 * 86_400_000),
      onboardingProfile: { status: "completed" },
      settings: { create: {} },
      users: { create: { email, password: "disabled-qa-password", role: "owner", firstName: "QA" } },
    },
  })

  try {
    await prisma.billingOrder.create({
      data: {
        workshopId: workshop.id,
        type: "new_purchase",
        planTier: "premium",
        billingCycle: "monthly",
        amountMinor: 74900,
        grossAmountMinor: 74900,
        netAmountMinor: 62417,
        method: "card",
        reference,
      },
    })
    await page.goto(`/api/auth/dev-login?email=${encodeURIComponent(email)}&redirect=/settings/billing`)
    await expect(page).toHaveURL(/\/settings\/billing$/)
    await page.getByRole("button", { name: "Ödemeye devam et" }).click()
    await expect(page).toHaveURL(/\/settings\/billing$/)
    const dialog = page.getByRole("dialog", { name: "Ödemeyi tamamla" })
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('form[action="/api/payments/tami/initiate"] input[name="reference"]')).toHaveValue(reference)
    await expect(dialog.getByRole("heading", { name: "Ödeme bilgileri" })).toBeVisible()
    await expect(dialog.getByRole("heading", { name: "Ödeme özeti" })).toBeVisible()
    await dialog.locator('button[type="submit"]').click()
    await expect(dialog.getByText("Kart üzerindeki ismi girin.")).toBeVisible()
    await expect(dialog.getByRole("textbox", { name: "Kart numarası" })).toHaveAttribute("aria-invalid", "true")
    await dialog.getByRole("textbox", { name: "Kart üzerindeki isim" }).fill("QA Kullanıcı")
    await dialog.getByRole("textbox", { name: "Kart numarası" }).fill("4111111111111111")
    const nextYear = new Date().getFullYear() + 1
    await dialog.getByRole("textbox", { name: "Son kullanma tarihi" }).fill(`12${String(nextYear).slice(-2)}`)
    await dialog.getByRole("textbox", { name: "CVV" }).fill("123")
    await expect(dialog.locator('input[name="expireMonth"]')).toHaveValue("12")
    await expect(dialog.locator('input[name="expireYear"]')).toHaveValue(String(nextYear))
    await dialog.getByRole("textbox", { name: "Son kullanma tarihi" }).fill(`12${nextYear}`)
    await expect(dialog.locator('input[name="expireYear"]')).toHaveValue(String(nextYear))
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)

    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Paketi yönet" }).click()
    const manage = page.getByRole("dialog", { name: "Paketi yönet" })
    await expect(manage.getByRole("button", { name: "Ödemeye devam et" })).toBeVisible()
    await manage.getByRole("button", { name: "Ödemeye devam et" }).click()
    await expect(page.getByRole("dialog", { name: "Ödemeyi tamamla" })).toBeVisible()
    await page.keyboard.press("Escape")

    await page.getByRole("button", { name: "Talebi iptal et" }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Talebi iptal et" }).click()
    await expect(page.getByText("Bekleyen ödeme", { exact: true })).toHaveCount(0)
    expect((await prisma.billingOrder.findUnique({ where: { reference } }))?.status).toBe("cancelled")
    await page.goto("/settings/plans")
    await expect(page.getByRole("button", { name: "Bekleyen talebiniz var" })).toHaveCount(0)
    await expect(page.getByText(/Atölye başına · /)).toHaveCount(3)
  } finally {
    await prisma.auditLog.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.billingOrder.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.user.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.workshopSettings.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.workshop.delete({ where: { id: workshop.id } })
  }
})

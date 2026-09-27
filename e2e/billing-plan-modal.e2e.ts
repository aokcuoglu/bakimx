import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import { salesE2EPrisma as prisma } from "./helpers/sales-e2e-fixture"
import { formatMinor } from "../src/lib/billing/pricing"

test("owner compares plans and validates checkout in the modal; staff can only compare", async ({ page, browser }, testInfo) => {
  test.setTimeout(90_000)
  const key = randomUUID().slice(0, 8)
  const ownerEmail = `billing-modal-owner-${key}@example.test`
  const staffEmail = `billing-modal-staff-${key}@example.test`
  const technicianEmail = `billing-modal-tech-${key}@example.test`
  const workshop = await prisma.workshop.create({
    data: {
      loginCode: `bm-${key}`,
      name: "QA Paket Modalı",
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
      users: { create: [
        { email: ownerEmail, password: "disabled-qa-password", role: "owner", firstName: "QA" },
        { email: staffEmail, password: "disabled-qa-password", role: "manager", firstName: "QA" },
        { email: technicianEmail, password: "disabled-qa-password", role: "usta", firstName: "QA" },
      ] },
    },
  })
  try {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/api/auth/dev-login?email=${encodeURIComponent(ownerEmail)}&redirect=/billing`)
    await expect(page).toHaveURL(/\/account\/billing$/)
    await expect(page.getByRole("heading", { name: "Faturalandırma", exact: true }).last()).toBeVisible()
    await expect(page.getByRole("heading", { name: "Fatura bilgileri" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Ödeme geçmişi" })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath("billing-page-desktop.png"), fullPage: true, animations: "disabled" })
    await expect(page.getByRole("link", { name: "Paketler & Kullanım" })).toHaveCount(0)
    await expect(page.getByRole("link", { name: /Profesyonel.*Abonelik aktif.*Yönet/ })).toHaveAttribute("href", "/settings/plans")
    await page.getByRole("link", { name: "Paketler", exact: true }).click()
    await expect(page).toHaveURL(/\/account\/plans$/)
    await expect(page.getByRole("heading", { name: "Paketler", exact: true })).toBeVisible()
    await expect(page.getByRole("table", { name: "Paket özelliklerini karşılaştırın" })).toBeVisible()
    const comparison = page.getByRole("table", { name: "Paket özelliklerini karşılaştırın" })
    await expect(comparison.getByRole("button", { name: "Mevcut paket" })).toBeDisabled()
    await expect(comparison.getByRole("button", { name: "Yükselt" })).toBeVisible()
    const priceTops = await comparison.locator('thead tr').first().locator('th[scope="col"] > p:first-of-type').evaluateAll(
      (prices) => prices.slice(1).map((price) => price.getBoundingClientRect().top),
    )
    expect(priceTops).toHaveLength(3)
    expect(Math.max(...priceTops) - Math.min(...priceTops)).toBeLessThan(1)
    const actionTops = await comparison.locator("thead tr").nth(1).locator("td button").evaluateAll(
      (buttons) => buttons.map((button) => button.getBoundingClientRect().top),
    )
    expect(actionTops).toHaveLength(3)
    expect(Math.max(...actionTops) - Math.min(...actionTops)).toBeLessThan(1)

    await page.getByRole("button", { name: "Paketi yönet" }).click()
    const manage = page.getByRole("dialog", { name: "Paketi yönet" })
    await expect(manage).toBeVisible()
    await expect(manage.getByText("Mevcut plan")).toBeVisible()
    await expect(manage.getByRole("button", { name: "Değiştir" })).toBeVisible()
    await expect(manage.getByRole("button", { name: "Onayla" })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath("billing-manage-desktop.png"), animations: "disabled" })
    await manage.getByRole("button", { name: "Kapat" }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)

    await page.getByRole("table", { name: "Paket özelliklerini karşılaştırın" }).getByRole("button", { name: "Düşür" }).first().click()
    const downgrade = page.getByRole("dialog", { name: /paketine düşülsün mü/ })
    await expect(downgrade).toBeVisible()
    await expect(downgrade.getByRole("button", { name: "Düşür" })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath("billing-downgrade-desktop.png"), animations: "disabled" })
    await downgrade.getByRole("button", { name: "Vazgeç" }).click()

    await comparison.getByRole("button", { name: "Yükselt" }).click()
    const checkout = page.getByRole("dialog", { name: "Ödemeyi tamamla" })
    await expect(checkout).toBeVisible()
    await checkout.getByRole("radio", { name: /Yıllık/ }).click()
    await expect(checkout).toContainText("₺29.990")
    await checkout.getByRole("button", { name: "Siparişi oluştur" }).click()
    await expect(page.getByText("Vergi/TC kimlik no zorunludur")).toBeVisible()
    expect(await prisma.billingOrder.count({ where: { workshopId: workshop.id } })).toBe(0)
    await page.screenshot({ path: testInfo.outputPath("billing-modal-desktop.png"), animations: "disabled" })
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)

    await page.setViewportSize({ width: 360, height: 800 })
    await page.getByRole("button", { name: "Paketi yönet" }).click()
    await expect(page.getByRole("dialog", { name: "Paketi yönet" })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
    await page.screenshot({ path: testInfo.outputPath("billing-manage-mobile.png"), animations: "disabled" })
    await page.keyboard.press("Escape")

    await page.setViewportSize({ width: 1440, height: 900 })
    await comparison.getByRole("button", { name: "Yükselt" }).click()
    await page.getByRole("dialog", { name: "Ödemeyi tamamla" }).getByRole("radio", { name: /Yıllık/ }).click()
    await page.getByRole("dialog").getByRole("textbox", { name: "Vergi / TC kimlik no" }).fill("1234567890")
    await page.getByRole("dialog").getByRole("radio", { name: "Havale/EFT" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Siparişi oluştur" }).click()
    await expect(page.getByRole("dialog", { name: "Siparişiniz" })).toBeVisible()
    const order = await prisma.billingOrder.findFirstOrThrow({ where: { workshopId: workshop.id } })
    expect(order).toMatchObject({ planTier: "premium", billingCycle: "yearly", method: "havale", status: "pending_payment" })
    await expect(page.getByRole("dialog", { name: "Siparişiniz" })).toContainText(formatMinor(order.amountMinor))
    await expect(page.getByRole("dialog", { name: "Siparişiniz" })).toContainText(order.reference)
    await page.getByRole("dialog").getByRole("button", { name: "Sayfaya dön" }).click()
    await page.goto("/settings/billing")
    await expect(page.getByText("Bekleyen ödeme", { exact: false })).toBeVisible()
    await page.goto("/settings/plans")
    await page.getByRole("button", { name: "Paketi yönet" }).click()
    await expect(page.getByRole("dialog", { name: "Paketi yönet" }).getByRole("button", { name: "Onayla" })).toBeDisabled()
    await page.keyboard.press("Escape")

    const staffContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    try {
      const staffPage = await staffContext.newPage()
      await staffPage.goto(`/api/auth/dev-login?email=${encodeURIComponent(staffEmail)}&redirect=/settings/plans`)
      await expect(staffPage.getByText("Paket değişikliği için yöneticinizle görüşün").first()).toBeVisible()
      await staffPage.getByRole("button", { name: "Paketi yönet" }).click()
      const staffDialog = staffPage.getByRole("dialog", { name: "Paketi yönet" })
      await expect(staffDialog.getByRole("button", { name: "Onayla" })).toBeDisabled()
    } finally {
      await staffContext.close()
    }

    const technicianContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    try {
      const technicianPage = await technicianContext.newPage()
      await technicianPage.goto(`/api/auth/dev-login?email=${encodeURIComponent(technicianEmail)}&redirect=/account`)
      await expect(technicianPage.getByRole("heading", { name: "Profil Bilgileri" })).toBeVisible()
      await expect(technicianPage.getByRole("link", { name: "Paketler", exact: true })).toHaveCount(0)
      await expect(technicianPage.getByRole("button", { name: "Paketi yönet" })).toHaveCount(0)
      await technicianPage.goto("/settings/plans")
      await expect(technicianPage).toHaveURL(/\/account$/)
      await technicianPage.goto("/settings/billing")
      await expect(technicianPage).toHaveURL(/\/account$/)
    } finally {
      await technicianContext.close()
    }

    await prisma.billingOrder.deleteMany({ where: { workshopId: workshop.id } })
    await page.reload()
    await page.getByRole("table", { name: "Paket özelliklerini karşılaştırın" }).getByRole("button", { name: "Yükselt" }).click()
    await page.getByRole("dialog", { name: "Ödemeyi tamamla" }).getByRole("button", { name: "Siparişi oluştur" }).click()
    const cardDialog = page.getByRole("dialog", { name: "Siparişiniz" })
    await expect(cardDialog).toContainText("3D Secure")
    const cardOrder = await prisma.billingOrder.findFirstOrThrow({ where: { workshopId: workshop.id } })
    expect(cardOrder.method).toBe("card")
    await expect(cardDialog.locator('form[action="/api/payments/tami/initiate"] input[name="reference"]')).toHaveValue(cardOrder.reference)
  } finally {
    await prisma.auditLog.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.billingOrder.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.user.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.workshopSettings.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.workshop.delete({ where: { id: workshop.id } })
  }
})

test("Lite trial advertises Premium access from the sidebar and Account", async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const key = randomUUID().slice(0, 8)
  const email = `billing-trial-${key}@example.test`
  const workshop = await prisma.workshop.create({
    data: {
      loginCode: `bt-${key}`,
      name: "QA Premium Deneme",
      phone: "05550000000",
      city: "İstanbul",
      address: "QA adresi",
      approvalStatus: "approved",
      subscriptionStatus: "trialing",
      planTier: "lite",
      trialEndsAt: new Date(Date.now() + 9 * 86_400_000),
      onboardingProfile: { status: "completed" },
      settings: { create: {} },
      users: { create: { email, password: "disabled-qa-password", role: "owner", firstName: "QA" } },
    },
  })
  try {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/api/auth/dev-login?email=${encodeURIComponent(email)}&redirect=/account`)
    const status = page.getByRole("link", { name: /iş günü kaldı.*Premium denemesi.*Paket seç/ })
    await expect(status).toBeVisible()
    await status.click()
    await expect(page).toHaveURL(/\/account\/plans$/)
    await expect(page.getByRole("heading", { name: "Premium denemesi" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Paketi yönet" })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath("plans-trial-desktop.png"), fullPage: true, animations: "disabled" })
    await page.goto("/settings/billing")
    await expect(page.getByText(/Premium denemeniz .* tarihinde bitiyor/)).toBeVisible()
    await expect(page.getByRole("progressbar", { name: "Koltuk kullanımı" })).toHaveAttribute("aria-valuemax", "15")
    await page.screenshot({ path: testInfo.outputPath("billing-trial-desktop.png"), fullPage: true, animations: "disabled" })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: testInfo.outputPath("billing-trial-mobile.png"), fullPage: true, animations: "disabled" })
    await page.goto("/settings/plans")
    await page.screenshot({ path: testInfo.outputPath("plans-trial-mobile.png"), fullPage: true, animations: "disabled" })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    for (const width of [320, 768]) {
      await page.setViewportSize({ width, height: 844 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.goto("/settings/billing")
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.goto("/settings/plans")
    }
  } finally {
    await prisma.auditLog.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.user.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.workshopSettings.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.workshop.delete({ where: { id: workshop.id } })
  }
})

test.afterAll(async () => { await prisma.$disconnect() })

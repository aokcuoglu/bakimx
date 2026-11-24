import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import { salesE2EPrisma as prisma } from "./helpers/sales-e2e-fixture"
import { formatMinor } from "../src/lib/billing/pricing"

test("owner renews the single package from the manage dialog; staff can only view", async ({ page, browser }, testInfo) => {
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
    await expect(page.getByRole("link", { name: /Servis Paketi.*Abonelik aktif.*Yönet/ })).toHaveAttribute("href", "/settings/plans")
    await page.getByRole("link", { name: "Paketler", exact: true }).click()
    await expect(page).toHaveURL(/\/account\/plans$/)
    await expect(page.getByRole("heading", { name: "Paketler", exact: true })).toBeVisible()
    await expect(page.getByRole("table", { name: "Pakete dahil olanlar" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Mevcut paket" })).toBeDisabled()
    await expect(page.getByRole("region", { name: "Pakete dahil olmayan ek özellikler" })).toContainText("Şaseden parça")

    await page.getByRole("button", { name: "Paketi yönet" }).click()
    const manage = page.getByRole("dialog", { name: "Paketi yönet" })
    await expect(manage).toBeVisible()
    await expect(manage.getByText("Mevcut paket", { exact: true })).toBeVisible()
    await expect(manage.getByRole("button", { name: "Değiştir" })).toHaveCount(0)
    await expect(manage.getByRole("button", { name: "Onayla" })).toBeDisabled()
    await expect(manage.getByRole("link", { name: "Ek kullanıcı için iletişim" })).toHaveAttribute("href", /wa\.me/)
    await page.screenshot({ path: testInfo.outputPath("billing-manage-desktop.png"), animations: "disabled" })
    await manage.getByRole("radio", { name: /Yıllık/ }).click()
    await expect(manage).toContainText("₺14.990")
    await manage.getByRole("button", { name: "Onayla" }).click()
    await expect(manage.getByText("Vergi/TC kimlik no en az 10 hane olmalıdır.")).toBeVisible()
    expect(await prisma.billingOrder.count({ where: { workshopId: workshop.id } })).toBe(0)
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)

    await page.setViewportSize({ width: 360, height: 800 })
    await page.getByRole("button", { name: "Paketi yönet" }).click()
    await expect(page.getByRole("dialog", { name: "Paketi yönet" })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
    await page.screenshot({ path: testInfo.outputPath("billing-manage-mobile.png"), animations: "disabled" })
    await page.keyboard.press("Escape")

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole("button", { name: "Paketi yönet" }).click()
    const renew = page.getByRole("dialog", { name: "Paketi yönet" })
    await renew.getByRole("radio", { name: /Yıllık/ }).click()
    await renew.getByRole("textbox", { name: "Vergi / TC kimlik no" }).fill("1234567890")
    await renew.getByRole("radio", { name: "Havale/EFT" }).click()
    await renew.getByRole("button", { name: "Onayla" }).click()
    await expect(page.getByRole("dialog", { name: "Siparişiniz" })).toBeVisible()
    const order = await prisma.billingOrder.findFirstOrThrow({ where: { workshopId: workshop.id } })
    expect(order).toMatchObject({ planTier: "pro", billingCycle: "yearly", method: "havale", status: "pending_payment", type: "renewal", amountMinor: 1_499_000 })
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
    await page.getByRole("button", { name: "Paketi yönet" }).click()
    const cardRenew = page.getByRole("dialog", { name: "Paketi yönet" })
    await cardRenew.getByRole("radio", { name: /Yıllık/ }).click()
    await cardRenew.getByRole("textbox", { name: "Vergi / TC kimlik no" }).fill("1234567890")
    await cardRenew.getByRole("button", { name: "Onayla" }).click()
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

test("trial opens add-ons, shows trial status and buys the package from the plans page", async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const key = randomUUID().slice(0, 8)
  const email = `billing-trial-${key}@example.test`
  const workshop = await prisma.workshop.create({
    data: {
      loginCode: `bt-${key}`,
      name: "QA Servis Paketi Deneme",
      phone: "05550000000",
      city: "İstanbul",
      address: "QA adresi",
      approvalStatus: "approved",
      subscriptionStatus: "trialing",
      planTier: "pro",
      trialEndsAt: new Date(Date.now() + 9 * 86_400_000),
      onboardingProfile: { status: "completed" },
      settings: { create: {} },
      users: { create: { email, password: "disabled-qa-password", role: "owner", firstName: "QA" } },
    },
  })
  try {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`/api/auth/dev-login?email=${encodeURIComponent(email)}&redirect=/account`)
    const status = page.getByRole("link", { name: /iş günü kaldı.*Ücretsiz deneme.*Paketi al/ })
    await expect(status).toBeVisible()
    await status.click()
    await expect(page).toHaveURL(/\/account\/plans$/)
    await expect(page.getByText("Deneme · ek özellikler dahil")).toBeVisible()
    await expect(page.getByRole("button", { name: "Paketi yönet" })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath("plans-trial-desktop.png"), fullPage: true, animations: "disabled" })
    await page.getByRole("button", { name: "Paketi satın al" }).click()
    const checkout = page.getByRole("dialog", { name: "Ödemeyi tamamla" })
    await expect(checkout).toBeVisible()
    await expect(checkout).toContainText("Servis Paketi")
    await expect(checkout).toContainText("₺14.990")
    await checkout.getByRole("button", { name: "Siparişi oluştur" }).click()
    await expect(page.getByText("Vergi/TC kimlik no zorunludur")).toBeVisible()
    expect(await prisma.billingOrder.count({ where: { workshopId: workshop.id } })).toBe(0)
    await page.keyboard.press("Escape")
    await page.goto("/settings/billing")
    await expect(page.getByText(/Ücretsiz denemeniz .* tarihinde bitiyor/)).toBeVisible()
    // Deneme "Paket + ek özellikler" profiline çözülür (TRIAL_ACCESS_TIER).
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
    await prisma.billingOrder.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.user.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.workshopSettings.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.workshop.delete({ where: { id: workshop.id } })
  }
})

test.afterAll(async () => { await prisma.$disconnect() })

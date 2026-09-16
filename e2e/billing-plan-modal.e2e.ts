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
    await expect(page).toHaveURL(/\/account#paket$/)
    await expect(page.getByRole("link", { name: "Paketler & Kullanım" })).toHaveCount(0)
    await expect(page.getByRole("link", { name: /Profesyonel.*Abonelik aktif.*Yönet/ })).toHaveAttribute("href", "/account#paket")
    await page.getByRole("button", { name: "Paketi yönet" }).click()
    const dialog = page.getByRole("dialog", { name: "Paketi yönet" })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Kapat" })).toBeFocused()
    await expect(dialog.getByText("Profesyonel", { exact: true }).first()).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Siparişi oluştur" })).toBeVisible()
    await dialog.getByRole("button", { name: "Paket değiştir" }).click()
    await expect(page.getByRole("dialog", { name: "Paketleri karşılaştır" })).toBeVisible()
    await page.getByRole("dialog").getByRole("radio", { name: /Yıllık/ }).click()
    await expect(page.getByRole("dialog").getByRole("table", { name: "Paket özelliklerini karşılaştırın" })).toBeVisible()
    await page.getByRole("dialog").getByRole("region", { name: "Premium paketi" }).getByRole("button", { name: "Bu paketi seç" }).click()
    await expect(page.getByRole("dialog", { name: "Paketi yönet" })).toContainText("₺29.990")
    await page.getByRole("dialog").getByRole("button", { name: "Siparişi oluştur" }).click()
    await expect(page.getByText("Vergi/TC kimlik no zorunludur")).toBeVisible()
    expect(await prisma.billingOrder.count({ where: { workshopId: workshop.id } })).toBe(0)
    await page.screenshot({ path: testInfo.outputPath("billing-modal-desktop.png"), animations: "disabled" })
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Paketi yönet" })).toBeFocused()

    await page.setViewportSize({ width: 360, height: 800 })
    await page.getByRole("button", { name: "Paketi yönet" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Paket değiştir" }).click()
    await page.screenshot({ path: testInfo.outputPath("billing-compare-mobile.png"), animations: "disabled" })
    await page.getByRole("dialog").getByRole("region", { name: "Lite paketi" }).getByRole("button", { name: "Bu paketi seç" }).click()
    await expect(page.getByRole("dialog")).toContainText("fazla kullanıcı veya davet devre dışı bırakılacak")
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
    await page.screenshot({ path: testInfo.outputPath("billing-modal-mobile.png"), animations: "disabled" })
    await page.keyboard.press("Escape")

    await page.getByRole("button", { name: "Paketi yönet" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Paket değiştir" }).click()
    await page.getByRole("dialog").getByRole("region", { name: "Premium paketi" }).getByRole("button", { name: "Bu paketi seç" }).click()
    await page.getByRole("dialog").getByRole("textbox", { name: "Vergi / TC kimlik no" }).fill("1234567890")
    await page.getByRole("dialog").getByRole("radio", { name: "Havale/EFT" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Siparişi oluştur" }).click()
    await expect(page.getByRole("dialog", { name: "Siparişiniz" })).toBeVisible()
    const order = await prisma.billingOrder.findFirstOrThrow({ where: { workshopId: workshop.id } })
    expect(order).toMatchObject({ planTier: "premium", billingCycle: "yearly", method: "havale", status: "pending_payment" })
    await expect(page.getByRole("dialog", { name: "Siparişiniz" })).toContainText(formatMinor(order.amountMinor))
    await expect(page.getByRole("dialog", { name: "Siparişiniz" })).toContainText(order.reference)
    await page.getByRole("dialog").getByRole("button", { name: "Hesaba dön" }).click()
    await page.getByRole("button", { name: "Paketi yönet" }).click()
    await expect(page.getByRole("dialog")).toContainText("Bekleyen bir paket talebiniz var")
    await expect(page.getByRole("dialog").getByRole("button", { name: "Siparişi oluştur" })).toHaveCount(0)
    await page.keyboard.press("Escape")

    const staffContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    try {
      const staffPage = await staffContext.newPage()
      await staffPage.goto(`/api/auth/dev-login?email=${encodeURIComponent(staffEmail)}&redirect=/account`)
      await staffPage.getByRole("button", { name: "Paketi yönet" }).click()
      const staffDialog = staffPage.getByRole("dialog")
      await expect(staffDialog).toContainText("Paket değişikliği için yöneticinizle görüşün")
      await expect(staffDialog.getByRole("button", { name: "Siparişi oluştur" })).toHaveCount(0)
      await staffDialog.getByRole("button", { name: "Paket değiştir" }).click()
      await expect(staffPage.getByRole("dialog", { name: "Paketleri karşılaştır" })).toBeVisible()
    } finally {
      await staffContext.close()
    }

    const technicianContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    try {
      const technicianPage = await technicianContext.newPage()
      await technicianPage.goto(`/api/auth/dev-login?email=${encodeURIComponent(technicianEmail)}&redirect=/account`)
      await expect(technicianPage.getByRole("heading", { name: "Profil Bilgileri" })).toBeVisible()
      await expect(technicianPage.getByRole("heading", { name: "Paket ve kullanım" })).toHaveCount(0)
      await expect(technicianPage.getByRole("button", { name: "Paketi yönet" })).toHaveCount(0)
    } finally {
      await technicianContext.close()
    }

    await prisma.billingOrder.deleteMany({ where: { workshopId: workshop.id } })
    await page.reload()
    await page.getByRole("button", { name: "Paketi yönet" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Paket değiştir" }).click()
    await page.getByRole("dialog").getByRole("region", { name: "Premium paketi" }).getByRole("button", { name: "Bu paketi seç" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Siparişi oluştur" }).click()
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
    await expect(page).toHaveURL(/\/account#paket$/)
    await expect(page.getByText("Premium deneme hakları")).toBeVisible()
    await expect(page.getByRole("button", { name: "Paketi yönet" })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath("account-trial-desktop.png"), fullPage: true, animations: "disabled" })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: testInfo.outputPath("account-trial-mobile.png"), fullPage: true, animations: "disabled" })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  } finally {
    await prisma.auditLog.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.user.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.workshopSettings.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.workshop.delete({ where: { id: workshop.id } })
  }
})

test.afterAll(async () => { await prisma.$disconnect() })

import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import { salesE2EPrisma as prisma } from "./helpers/sales-e2e-fixture"

test("Oluştur modalı klavye ve dar ekranlarda kullanılabilir", async ({
  page,
}, testInfo) => {
  const key = randomUUID().slice(0, 8)
  const email = `create-center-${key}@example.test`
  const workshop = await prisma.workshop.create({
    data: {
      loginCode: `cc-${key}`,
      name: "QA Oluştur Modalı",
      phone: "05550000000",
      city: "İstanbul",
      address: "QA adresi",
      approvalStatus: "approved",
      subscriptionStatus: "active",
      planTier: "pro",
      onboardingProfile: { status: "completed" },
      settings: { create: {} },
      users: {
        create: {
          email,
          password: "disabled-qa-password",
          role: "owner",
          firstName: "QA",
        },
      },
    },
  })

  try {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(
      `/api/auth/dev-login?email=${encodeURIComponent(email)}&redirect=/orders`,
    )

    const trigger = page.getByRole("button", { name: "Yeni kayıt oluştur" })
    await trigger.click()

    const dialog = page.getByRole("dialog", {
      name: "Ne oluşturmak istiyorsunuz?",
    })
    await expect(dialog).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Oluşturma merkezini kapat" }),
    ).toBeFocused()
    await expect(dialog.getByRole("link")).toHaveCount(4)
    await expect(dialog.getByRole("link", { name: /İş Emri/ })).toHaveAttribute(
      "href",
      "/orders/new",
    )
    await dialog.screenshot({ path: testInfo.outputPath("create-modal-desktop.png"), animations: "disabled" })

    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()

    await page.setViewportSize({ width: 320, height: 640 })
    await trigger.click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("link")).toHaveCount(4)
    await dialog.screenshot({ path: testInfo.outputPath("create-modal-mobile.png"), animations: "disabled" })
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const bounds = await dialog.boundingBox()
      expect(bounds).not.toBeNull()
      expect(bounds!.x).toBeGreaterThanOrEqual(-1)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1)
    }
  } finally {
    await prisma.auditLog.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.user.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.workshopSettings.deleteMany({
      where: { workshopId: workshop.id },
    })
    await prisma.workshop.delete({ where: { id: workshop.id } })
  }
})

test.afterAll(async () => {
  await prisma.$disconnect()
})

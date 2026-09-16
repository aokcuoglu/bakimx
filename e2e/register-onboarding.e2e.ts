import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import { salesE2EPrisma as prisma } from "./helpers/sales-e2e-fixture"

test("onboarding uses URL steps and gates the app until completion", async ({ page }) => {
  const key = `qa-onboarding-${randomUUID()}`
  const email = `${key}@example.test`
  const workshop = await prisma.workshop.create({
    data: {
      loginCode: `qa-ob-${randomUUID().slice(0, 8)}`,
      name: "QA — geçici kayıt kurulum testi",
      phone: "05550000000",
      city: "İstanbul",
      address: "QA test adresi",
      onboardingProfile: { status: "pending" },
      settings: { create: {} },
      users: {
        create: {
          email,
          password: "disabled-qa-password-no-login",
          role: "owner",
          firstName: "QA",
          lastName: "Onboarding",
        },
      },
    },
  })

  try {
    const submissions: string[] = []
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/onboarding") {
        submissions.push(request.postData() ?? "")
      }
    })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto(`/api/auth/dev-login?email=${encodeURIComponent(email)}&redirect=/dashboard`)
    await expect(page).toHaveURL(/\/onboarding\/sektor$/)
    await expect(page.getByRole("heading", { name: "Sektörünüzü seçin" })).toBeVisible()
    await expect(page.getByRole("dialog")).toHaveCount(0)

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(page.getByRole("heading", { name: "Sektörünüzü seçin" })).toBeVisible()
      const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      expect(hasHorizontalOverflow, `${width}px yatay taşma`).toBe(false)
      const preview = page.getByRole("complementary", { name: "BakımX önizlemesi" })
      if (width >= 1024) await expect(preview).toBeVisible()
      else await expect(preview).toBeHidden()
    }
    await page.setViewportSize({ width: 360, height: 800 })

    await page.goto("/customers")
    await expect(page).toHaveURL(/\/onboarding\/sektor$/)
    await page.goto("/onboarding")
    await expect(page).toHaveURL(/\/onboarding\/sektor$/)
    await page.goto("/onboarding/moduller")
    await expect(page).toHaveURL(/\/onboarding\/sektor$/)

    await page.getByRole("radio", { name: /Mekanik Servis/ }).click()
    await page.getByRole("button", { name: "Devam Et", exact: true }).click()
    await expect(page).toHaveURL(/\/onboarding\/is-detaylari$/)
    await expect(page.getByRole("heading", { name: "İş detayları", exact: true })).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL(/\/onboarding\/sektor$/)
    await expect(page.getByRole("radio", { name: /Mekanik Servis/ })).toHaveAttribute("data-state", "on")
    await page.reload()
    await expect(page.getByRole("radio", { name: /Mekanik Servis/ })).toHaveAttribute("data-state", "on")
    await page.getByRole("button", { name: "Devam Et", exact: true }).click()
    await expect(page).toHaveURL(/\/onboarding\/is-detaylari$/)
    await page.getByRole("button", { name: "Devam Et", exact: true }).click()
    await expect(page).toHaveURL(/\/onboarding\/ekip$/)
    await page.getByRole("radio", { name: /Sadece Ben/i }).click()

    // The same native click must not turn into a submit when React renders
    // the final-step button in the position previously occupied by Next.
    await page.getByRole("button", { name: "Devam Et", exact: true }).click()
    await expect(page).toHaveURL(/\/onboarding\/moduller$/)
    await expect(page.getByRole("heading", { name: "Modüllerinizi seçin", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Kurulumu Tamamla", exact: true })).toBeEnabled()
    expect(submissions).toHaveLength(0)
    const pending = await prisma.workshop.findUniqueOrThrow({
      where: { id: workshop.id }, select: { onboardingProfile: true },
    })
    expect(pending.onboardingProfile).toEqual({ status: "pending" })

    const savedResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/onboarding" && response.request().method() === "POST",
    )
    await page.getByRole("button", { name: "Kurulumu Tamamla", exact: true }).click()
    expect((await savedResponse).status()).toBe(200)
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.goto("/onboarding/sektor")
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.goto("/customers")
    await expect(page.getByRole("heading", { level: 2, name: "Müşteriler", exact: true })).toBeVisible()
    expect(submissions).toHaveLength(1)
    const completed = await prisma.workshop.findUniqueOrThrow({
      where: { id: workshop.id }, select: { onboardingProfile: true },
    })
    expect(completed.onboardingProfile).toMatchObject({
      status: "completed", sector: "mechanical_service", teamSize: "solo",
    })
  } finally {
    await prisma.auditLog.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.user.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.workshopSettings.deleteMany({ where: { workshopId: workshop.id } })
    await prisma.workshop.delete({ where: { id: workshop.id } })
  }
})

test.afterAll(async () => { await prisma.$disconnect() })

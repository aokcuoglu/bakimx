import { expect, test } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { randomUUID } from "node:crypto"

const db = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) })
test.use({ hasTouch: true })

let workshopId: string, orderId: string, email: string

test.beforeAll(async () => {
  if (process.env.NODE_ENV === "production" || !process.env.DATABASE_URL) throw new Error("Explicit non-production database required")
  const prefix = `part-popup-${randomUUID()}`
  const workshop = await db.workshop.create({ data: { loginCode: randomUUID(), name: prefix, phone: "05550000000", city: "İstanbul", address: "QA", approvalStatus: "approved", subscriptionStatus: "active", planTier: "premium" } })
  workshopId = workshop.id; email = `${prefix}@example.com`
  await db.user.create({ data: { workshopId, email, password: "unusable-qa-password", role: "owner", firstName: "QA" } })
  const customer = await db.customer.create({ data: { workshopId, firstName: "QA", lastName: "Fotoğraf", phone: "05550000000" } })
  const vehicle = await db.vehicle.create({ data: { workshopId, customerId: customer.id, plate: "QA POPUP 702", brand: "QA", model: "Test", catalogVehicleTypeId: 0 /* Synthetic identity: mocked search, no provider prefetch. */ } })
  const intake = await db.vehicleIntakeForm.create({ data: { workshopId, customerId: customer.id, vehicleId: vehicle.id, customerComplaint: "Part popup regression" } })
  orderId = (await db.serviceOrder.create({ data: { workshopId, intakeFormId: intake.id } })).id
})
test.afterAll(async () => {
  if (workshopId) {
    const where = { workshopId }
    await db.auditLog.deleteMany({ where })
    await db.intakeTimelineEvent.deleteMany({ where })
    await db.serviceOrderItem.deleteMany({ where })
    await db.serviceOrder.deleteMany({ where })
    await db.vehicleIntakeForm.deleteMany({ where })
    await db.vehicle.deleteMany({ where })
    await db.customer.deleteMany({ where })
    await db.user.deleteMany({ where })
    await db.workshopSettings.deleteMany({ where })
    await db.workshop.delete({ where: { id: workshopId } })
  }
  await db.$disconnect()
})


const article = {
  tecdocArticleId: 702001, articleNo: "QA-702", productName: "QA fren diski",
  supplierName: "QA", supplierId: 1, imageUrl: null, categoryId: 1,
  categoryName: "Fren diski", matchedOems: [],
}

for (const width of [390, 1440]) {
  test(`part popup supports details and selection at ${width}px`, async ({ page }) => {
    await db.serviceOrderItem.deleteMany({ where: { serviceOrderId: orderId } })
    await page.setViewportSize({ width, height: 900 })
    await page.route("**/api/tecdoc/articles/search?*", route => route.fulfill({ json: { articles: [article] } }))
    await page.route("**/api/parts/search?*", route => route.fulfill({ json: { parts: [] } }))
    await page.route("**/api/catalog/*/search?*", route => route.fulfill({ json: { products: [] } }))
    await page.route("**/api/tecdoc/articles/702001?*", route => route.fulfill({ json: {
      detail: { ...article, specs: [{ name: "Dış çap [mm]", value: "300" }], oems: [], eanNumbers: [] },
      compatibility: { status: "unknown", fitment: null },
    } }))
    let submitted = ""
    await page.route("**/api/orders/items", async route => {
      if (route.request().method() !== "POST") return route.continue()
      submitted = route.request().postData() ?? ""
      await route.continue()
    })
    await page.goto(`/api/auth/dev-login?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(`/orders/${orderId}?tab=parcalar`)}`)
    await page.getByRole("tab", { name: /Parça & İşçilik/ }).click()
    await page.getByRole("button", { name: "Parça ekle", exact: true }).click()
    const composer = page.getByRole("dialog", { name: "Parça ekle", exact: true })
    const input = composer.getByPlaceholder("Parça no, adı, marka veya OEM ara…")
    await input.fill("QA")
    const option = page.getByRole("option", { name: /QA fren diski/ })
    await expect(option).toBeVisible()
    const info = option.getByRole("button", { name: "Parça detayı" })
    if (width === 390) await info.tap({ timeout: 5000 })
    else await info.click({ timeout: 5000 })
    const detail = page.getByRole("dialog", { name: "QA fren diski", exact: true })
    await expect(detail.getByText("Dış çap [mm]", { exact: true })).toBeVisible()
    expect(submitted).toBe("")
    await detail.getByRole("button", { name: "Kapat", exact: true }).click()
    await expect(composer).toBeVisible()
    await input.fill("QA yeniden")
    await expect(option).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(option).toBeHidden()
    await expect(composer).toBeVisible()
    await expect(input).toHaveValue("QA yeniden")
    await input.fill("QA fren")
    await expect(option).toBeVisible()
    const selection = option.getByText("QA fren diski", { exact: true })
    if (width === 390) await selection.tap({ timeout: 5000 })
    else await selection.click({ timeout: 5000 })
    await expect(composer).toBeHidden()
    expect(submitted).toMatch(/name="name"\r?\n\r?\nQA fren diski/)
    expect(submitted).toMatch(/name="tecdocArticleId"\r?\n\r?\n702001/)
    await expect(page.getByText("QA fren diski", { exact: true }).filter({ visible: true }).first()).toBeVisible()
    const saved = await db.serviceOrderItem.findMany({ where: { serviceOrderId: orderId } })
    expect(saved).toHaveLength(1)
    expect(saved[0].tecdocArticleId).toBe(article.tecdocArticleId)
    await page.reload()
    await page.getByRole("tab", { name: /Parça & İşçilik/ }).click()
    await expect(page.getByText("QA fren diski", { exact: true }).filter({ visible: true }).first()).toBeVisible()
  })
}

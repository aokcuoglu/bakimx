import { expect, test } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { randomUUID } from "node:crypto"

const db = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) })
let workshopId: string, orderId: string, email: string

test.beforeAll(async () => {
  if (process.env.NODE_ENV === "production" || !process.env.DATABASE_URL) throw new Error("Explicit non-production database required")
  const prefix = `photo-ui-${randomUUID()}`
  const workshop = await db.workshop.create({ data: { loginCode: randomUUID(), name: prefix, phone: "05550000000", city: "İstanbul", address: "QA", approvalStatus: "approved", subscriptionStatus: "active", planTier: "premium" } })
  workshopId = workshop.id; email = `${prefix}@example.com`
  await db.user.create({ data: { workshopId, email, password: "unusable-qa-password", role: "owner", firstName: "QA" } })
  const customer = await db.customer.create({ data: { workshopId, firstName: "QA", lastName: "Fotoğraf", phone: "05550000000" } })
  const vehicle = await db.vehicle.create({ data: { workshopId, customerId: customer.id, plate: "QA PHOTO 603", brand: "QA", model: "Test" } })
  const intake = await db.vehicleIntakeForm.create({ data: { workshopId, customerId: customer.id, vehicleId: vehicle.id, customerComplaint: "Photo editor regression" } })
  orderId = (await db.serviceOrder.create({ data: { workshopId, intakeFormId: intake.id } })).id
})
test.afterAll(async () => {
  if (workshopId) {
    const where = { workshopId }
    await db.photoAnnotationVersion.deleteMany({ where: { photo: where } })
    await db.vehiclePhoto.deleteMany({ where })
    await db.auditLog.deleteMany({ where })
    await db.intakeTimelineEvent.deleteMany({ where })
    await db.serviceOrder.deleteMany({ where })
    await db.vehicleIntakeForm.deleteMany({ where })
    await db.vehicle.deleteMany({ where })
    await db.customer.deleteMany({ where })
    await db.user.deleteMany({ where })
    await db.workshop.delete({ where: { id: workshopId } })
  }
  await db.$disconnect()
})

test("photo source survives touch annotation, retry, zoom and saved-version editing", async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto(`/api/auth/dev-login?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(`/orders/${orderId}?tab=kanit`)}`)
  await page.getByRole("button", { name: "Bölge listesinden hasar ekle", exact: true }).click()
  await page.getByRole("button", { name: "Ön tampon", exact: true }).click()
  const jpeg = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = 800; canvas.height = 400
    const ctx = canvas.getContext("2d")!; ctx.fillStyle = "white"; ctx.fillRect(0, 0, 800, 400)
    ctx.fillStyle = "gray"; ctx.fillRect(200, 100, 400, 200)
    return canvas.toDataURL("image/jpeg").split(",")[1]
  })
  await page.locator('input[type="file"][multiple]').last().setInputFiles({ name: "qa.jpg", mimeType: "image/jpeg", buffer: Buffer.from(jpeg, "base64") })
  const canvas = page.locator(".konvajs-content")
  await expect(canvas).toBeVisible()
  await canvas.scrollIntoViewIfNeeded()
  const bounds = (await canvas.boundingBox())!
  for (const [type, fraction] of [["pointerdown", 0.2], ["pointermove", 0.5], ["pointerup", 0.5]] as const) {
    await canvas.dispatchEvent(type, { pointerId: 1, pointerType: "touch", isPrimary: true, buttons: type === "pointerup" ? 0 : 1, clientX: bounds.x + bounds.width * fraction, clientY: bounds.y + bounds.height * fraction })
  }
  await page.getByRole("button", { name: "Çizim 1: Ok", exact: true }).click()
  await page.getByRole("button", { name: "Sağa", exact: true }).click()
  await page.getByRole("button", { name: "Büyüt", exact: true }).click()
  await page.getByRole("button", { name: "Yakınlaştır", exact: true }).click()
  await page.getByRole("button", { name: "Geri al", exact: true }).click()
  await page.getByRole("button", { name: "İleri al", exact: true }).click()
  // Only the first derivative attempt fails: the source must not be uploaded twice.
  let fail = true
  await page.route("**/api/intakes/photos/annotations", async route => {
    if (route.request().method() === "POST" && fail) { fail = false; return route.fulfill({ status: 503, json: { error: "QA yeniden deneyin" } }) }
    return route.continue()
  })
  await page.getByRole("button", { name: "Fotoğrafı kaydet", exact: true }).click()
  await expect(page.getByText("QA yeniden deneyin", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Çizim 1: Ok", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Fotoğrafı kaydet", exact: true }).click()
  await expect(page.getByText("1 fotoğraf kaydedildi.", { exact: true })).toBeVisible()
  expect(await db.vehiclePhoto.count({ where: { workshopId } })).toBe(1)
  const photo = await db.vehiclePhoto.findFirstOrThrow({ where: { workshopId }, include: { annotationVersions: true } })
  expect(photo.annotationVersions).toHaveLength(1)
  expect(photo.annotationVersions[0].storageKey).not.toBe(photo.storageKey)
  const original = await page.request.get(`/api/photos?id=${photo.id}&variant=original`)
  const annotated = await page.request.get(`/api/photos?id=${photo.id}&variant=annotated`)
  expect(original.ok()).toBe(true); expect(annotated.ok()).toBe(true)
  expect(Buffer.compare(await original.body(), await annotated.body())).not.toBe(0)
  await page.getByRole("button", { name: "Çizimleri düzenle", exact: true }).click()
  await expect(page.getByRole("button", { name: "Çizim 1: Ok", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Çizim 1: Ok", exact: true }).click()
  await page.getByRole("button", { name: "Sağa", exact: true }).click()
  await page.getByRole("button", { name: "Fotoğrafı kaydet", exact: true }).click()
  await expect(page.getByRole("dialog", { name: "Fotoğraf çizimleri" })).toHaveCount(0)
  const versions = await db.photoAnnotationVersion.findMany({ where: { photoId: photo.id }, orderBy: { version: "asc" } })
  expect(versions).toHaveLength(2)
  expect(versions[1].storageKey).not.toBe(versions[0].storageKey)
  const points = versions.map(v => (v.document as { shapes: { points: number[] }[] }).shapes[0].points)
  expect(points[1][0] - points[0][0]).toBeCloseTo(0.01)
  expect(points[1][1]).toBe(points[0][1])
  await page.getByRole("button", { name: "Çizimleri düzenle", exact: true }).click()
  await expect(page.getByRole("button", { name: "Çizim 1: Ok", exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width)
  await page.screenshot({ path: test.info().outputPath("photo-editor-mobile.png"), animations: "disabled" })
})

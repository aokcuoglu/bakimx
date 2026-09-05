import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { randomUUID } from "node:crypto"

const db = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) })
const prefix = `damage603-${randomUUID()}`
const workshops: string[] = []
let intakeId: string, otherPhotoId: string, email: string, ownerId: string, orderId: string
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64")
const document = { version: 1, shapes: [{ id: "one", tool: "rect", color: "#000000", strokeWidth: 0.01, points: [0.1, 0.2, 0.7, 0.8] }] }

test.beforeAll(async () => {
  if (process.env.NODE_ENV === "production" || !process.env.DATABASE_URL) throw new Error("An explicit non-production test database is required")
  for (const suffix of ["a", "b"]) {
    const w = await db.workshop.create({ data: { loginCode: randomUUID(), name: `${prefix}-${suffix}`, phone: "05550000000", city: "İstanbul", address: "QA", approvalStatus: "approved", subscriptionStatus: "active", planTier: "premium" } })
    workshops.push(w.id)
    const user = await db.user.create({ data: { workshopId: w.id, email: `${prefix}-${suffix}@example.com`, password: "unusable-fixture-password", role: "owner", firstName: "QA" } })
    const customer = await db.customer.create({ data: { workshopId: w.id, firstName: "QA", lastName: "Hasar", phone: "05550000000" } })
    const vehicle = await db.vehicle.create({ data: { workshopId: w.id, customerId: customer.id, plate: `QA603${suffix}`, brand: "QA", model: "Test" } })
    const intake = await db.vehicleIntakeForm.create({ data: { workshopId: w.id, customerId: customer.id, vehicleId: vehicle.id, customerComplaint: "QA fixture" } })
    const order = await db.serviceOrder.create({ data: { workshopId: w.id, intakeFormId: intake.id } })
    if (suffix === "a") { intakeId = intake.id; email = user.email!; ownerId = user.id; orderId = order.id }
    else { otherPhotoId = (await db.vehiclePhoto.create({ data: { workshopId: w.id, intakeFormId: intake.id, type: "damage_detail", label: "Other tenant" } })).id }
  }
})
test.afterAll(async () => {
  // Only IDs created above are removed, in foreign-key order.
  const where = { workshopId: { in: workshops } }
  await db.photoAnnotationVersion.deleteMany({ where: { photo: where } })
  await db.damagePhoto.deleteMany({ where: { damageMark: where } })
  await db.damageMark.deleteMany({ where })
  await db.publicShareLink.deleteMany({ where })
  await db.vehiclePhoto.deleteMany({ where })
  await db.auditLog.deleteMany({ where })
  await db.intakeTimelineEvent.deleteMany({ where })
  await db.serviceOrder.deleteMany({ where })
  await db.vehicleIntakeForm.deleteMany({ where })
  await db.vehicle.deleteMany({ where })
  await db.customer.deleteMany({ where })
  await db.user.deleteMany({ where })
  await db.workshop.deleteMany({ where: { id: { in: workshops } } })
  await db.$disconnect()
})

test("numbering, inspection, photo links, editable versions and visibility remain consistent", async ({ request }) => {
  const login = await request.get(`/api/auth/dev-login?email=${encodeURIComponent(email)}&redirect=/orders`)
  expect(login.ok()).toBeTruthy()
  const url = `/api/intakes/damage?intakeFormId=${intakeId}`
  expect((await (await request.get(url)).json()).inspectionStatus).toBe("not_recorded")
  expect((await request.patch("/api/intakes/damage", { data: { intakeFormId: intakeId, inspectionStatus: "no_visible_damage", bodyType: "suv" } })).ok()).toBeTruthy()
  const inspected = await db.vehicleIntakeForm.findUniqueOrThrow({ where: { id: intakeId } })
  expect(inspected.inspectedById).toBe(ownerId)
  expect(inspected.inspectedAt).not.toBeNull()
  const input = { intakeFormId: intakeId, zone: "hood", damageType: "scratch", severity: "light", note: "İlk hasar", requestId: randomUUID() }
  const concurrent = await Promise.all([request.post("/api/intakes/damage", { data: input }), request.post("/api/intakes/damage", { data: input }), request.post("/api/intakes/damage", { data: { ...input, requestId: randomUUID() } })])
  for (const result of concurrent) expect(result.ok(), await result.text()).toBeTruthy()
  const records = await Promise.all(concurrent.map(r => r.json()))
  expect(records[0].mark.id).toBe(records[1].mark.id)
  expect(new Set(records.map(r => r.mark.number)).size).toBe(2)
  const mark = records[0].mark
  expect((await (await request.get(url)).json()).inspectionStatus).toBe("not_recorded")
  expect((await request.patch("/api/intakes/damage", { data: { intakeFormId: intakeId, inspectionStatus: "no_visible_damage" } })).ok()).toBeFalsy()
  expect((await request.patch("/api/intakes/damage", { data: { ...input, id: mark.id, photoIds: [otherPhotoId] } })).ok()).toBeFalsy()

  const uploadData = { intakeFormId: intakeId, requestId: randomUUID(), type: "damage_detail", label: "QA fotoğraf", file: { name: "qa.png", mimeType: "image/png", buffer: image } }
  const uploaded = await request.post("/api/intakes/photos", { multipart: uploadData })
  expect(uploaded.ok(), await uploaded.text()).toBeTruthy()
  const photoId = (await uploaded.json()).id
  expect((await (await request.post("/api/intakes/photos", { multipart: uploadData })).json()).id).toBe(photoId)
  for (const id of new Set(records.map(r => r.mark.id as string))) expect((await request.patch("/api/intakes/damage", { data: { ...input, id, photoIds: [photoId] } })).ok()).toBeTruthy()
  const annotate = { photoId, requestId: randomUUID(), expectedVersion: "0", document: JSON.stringify(document), file: { name: "annotated.png", mimeType: "image/png", buffer: image } }
  const version1 = await request.post("/api/intakes/photos/annotations", { multipart: annotate })
  expect(version1.ok(), await version1.text()).toBeTruthy()
  expect((await version1.json()).version).toBe(1)
  expect((await (await request.post("/api/intakes/photos/annotations", { multipart: annotate })).json()).version).toBe(1)
  expect((await request.post("/api/intakes/photos/annotations", { multipart: { ...annotate, requestId: randomUUID() } })).status()).toBe(409)
  expect((await (await request.get(`/api/intakes/photos/annotations?photoId=${photoId}`)).json()).document).toEqual(document)
  expect((await request.post("/api/intakes/photos/annotations", { multipart: { ...annotate, photoId: otherPhotoId } })).status()).toBe(404)
  const sourceKey = (await db.vehiclePhoto.findUniqueOrThrow({ where: { id: photoId } })).storageKey
  expect((await request.post("/api/intakes/photos/annotations", { multipart: { ...annotate, expectedVersion: "1", requestId: randomUUID() } })).ok()).toBeTruthy()
  expect(await db.photoAnnotationVersion.count({ where: { photoId } })).toBe(2)
  expect((await db.vehiclePhoto.findUniqueOrThrow({ where: { id: photoId } })).storageKey).toBe(sourceKey)

  for (const showDamage of [false, true]) for (const showPhotos of [false, true]) {
    const token = randomUUID()
    await db.publicShareLink.create({ data: { workshopId: workshops[0], intakeFormId: intakeId, token, showDamage, showPhotos } })
    const response = await request.get(`/s/${token}/pdf`)
    expect(response.ok(), await response.text()).toBeTruthy()
    const html = await response.text()
    expect(html.includes("Hasar Kayıtları")).toBe(showDamage)
    expect(html.includes(`/s/${token}/photos/${photoId}`)).toBe(showPhotos && showDamage)
    expect(html).not.toContain(sourceKey!)
    expect(html).not.toContain('"points"')
    const photo = await request.get(`/s/${token}/photos/${photoId}`)
    expect(photo.status()).toBe(showPhotos ? 200 : 404)
  }
  const expiredToken = randomUUID()
  await db.publicShareLink.create({ data: { workshopId: workshops[0], intakeFormId: intakeId, token: expiredToken, expiresAt: new Date(Date.now() - 1000) } })
  expect((await request.get(`/s/${expiredToken}/photos/${photoId}`)).status()).toBe(404)
  await db.serviceOrder.update({ where: { id: orderId }, data: { status: "delivered" } })
  expect((await request.post("/api/intakes/damage", { data: { ...input, requestId: randomUUID() } })).ok()).toBeFalsy()
  expect((await request.post("/api/intakes/photos/annotations", { multipart: { ...annotate, expectedVersion: "2", requestId: randomUUID() } })).status()).toBe(409)
  await db.serviceOrder.update({ where: { id: orderId }, data: { status: "draft" } })
  for (const id of new Set(records.map(r => r.mark.id as string))) expect((await request.delete(`/api/intakes/damage?id=${id}`)).ok()).toBeTruthy()
  const empty = await (await request.get(url)).json()
  expect(empty.marks).toEqual([])
  expect(empty.inspectionStatus).toBe("not_recorded")
  expect(await db.vehiclePhoto.count({ where: { id: photoId } })).toBe(1)
  expect(await db.damageMark.count({ where: { intakeFormId: intakeId, deletedAt: { not: null } } })).toBe(2)
  await db.workshop.update({ where: { id: workshops[0] }, data: { planTier: "lite" } })
  expect((await request.get(url)).ok()).toBeFalsy()
  expect((await request.get(`/api/intakes/photos/annotations?photoId=${photoId}`)).status()).toBe(403)
  expect((await request.post("/api/intakes/photos", { multipart: { ...uploadData, requestId: randomUUID() } })).ok()).toBeTruthy()
})

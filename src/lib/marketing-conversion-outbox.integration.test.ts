import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/db"
import { createServiceOrderForIntake } from "@/lib/orders/create-service-order"
import { claimRecordedMarketingConversions, recordMarketingConversion, CONVERSION_ENTITY } from "./marketing-conversion-outbox"

// Explicit opt-in; isolated local PostgreSQL only. Removes only this test's rows.
test.skipIf(process.env.LITE_ANALYTICS_DB_TESTS !== "true")("PostgreSQL conversions roll back, deduplicate and enforce owner/tenant claims", async () => {
  const url = new URL(process.env.DATABASE_URL!)
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/bakimx_lite_626") throw new Error("Requires isolated local bakimx_lite_626 database")
  const original = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED
  process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "true"
  const workshopIds: string[] = []
  try {
    for (let index = 0; index < 2; index++) {
      const workshop = await prisma.workshop.create({ data: { loginCode: `qa-${randomUUID().slice(0, 12)}`, name: "Analytics QA fixture", phone: "TEST", city: "TEST", address: "TEST", planTier: "pro" } })
      workshopIds.push(workshop.id)
    }
    const [workshopId, otherId] = workshopIds
    const attributedInput = { name: "paid_subscription_confirmed" as const, workshopId, key: "qa-attributed-order", payload: { plan_tier: "pro" as const, billing_cycle: "yearly" as const }, attribution: { campaignSource: "facebook", email: "must-not-persist@example.com" } }
    await expect(prisma.$transaction(async tx => { await recordMarketingConversion(tx, attributedInput); throw new Error("ROLLBACK_QA") })).rejects.toThrow("ROLLBACK_QA")
    expect(await prisma.auditLog.count({ where: { workshopId, entityType: CONVERSION_ENTITY } })).toBe(0)
    await Promise.all(Array.from({ length: 4 }, () => prisma.$transaction(tx => recordMarketingConversion(tx, attributedInput))))
    expect(await prisma.auditLog.count({ where: { workshopId, entityType: CONVERSION_ENTITY, action: "paid_subscription_confirmed" } })).toBe(1)
    // A real first and second work order through the shared transaction helper.
    const customer = await prisma.customer.create({ data: { workshopId, phone: "TEST" } })
    const vehicle = await prisma.vehicle.create({ data: { workshopId, customerId: customer.id, plate: "QA", brand: "QA", model: "QA" } })
    for (let index = 0; index < 2; index++) {
      await prisma.$transaction(async tx => {
        const intake = await tx.vehicleIntakeForm.create({ data: { workshopId, customerId: customer.id, vehicleId: vehicle.id, customerComplaint: "QA" } })
        await createServiceOrderForIntake(tx, workshopId, intake.id)
      })
    }
    expect(await prisma.auditLog.count({ where: { workshopId, action: "first_work_order_created" } })).toBe(1)
    const paid = { name: "paid_subscription_confirmed" as const, workshopId, key: "qa-confirmed-order", payload: { plan_tier: "pro" as const, billing_cycle: "monthly" as const } }
    await Promise.all(Array.from({ length: 4 }, () => prisma.$transaction(tx => recordMarketingConversion(tx, paid))))
    expect(await prisma.auditLog.count({ where: { workshopId, entityType: CONVERSION_ENTITY, action: "paid_subscription_confirmed" } })).toBe(2)
    const owner = { workshopId, role: "owner", mustChangePassword: false }
    for (const viewer of [null, { ...owner, role: "staff" }, { ...owner, impersonatorAdminId: "admin" }, { ...owner, mustChangePassword: true }, { ...owner, workshopId: otherId }]) {
      expect(await prisma.$transaction(tx => claimRecordedMarketingConversions(tx, viewer))).toEqual([])
    }
    const claims = await Promise.all(Array.from({ length: 4 }, () => prisma.$transaction(tx => claimRecordedMarketingConversions(tx, owner))))
    expect(claims.flat()).toHaveLength(3)
    expect(new Set(claims.flat().map(event => event.params.event_id)).size).toBe(3)
    expect(JSON.stringify(claims)).not.toContain("must-not-persist")
    expect(await prisma.$transaction(tx => claimRecordedMarketingConversions(tx, owner))).toEqual([])
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_ANALYTICS_ENABLED; else process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = original
    const where = { workshopId: { in: workshopIds } }
    await prisma.auditLog.deleteMany({ where })
    await prisma.serviceOrder.deleteMany({ where })
    await prisma.vehicleIntakeForm.deleteMany({ where })
    await prisma.vehicle.deleteMany({ where })
    await prisma.customer.deleteMany({ where })
    await prisma.workshop.deleteMany({ where: { id: { in: workshopIds } } })
  }
}, 30_000)

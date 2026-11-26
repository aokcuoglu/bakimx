import { afterEach, describe, expect, test } from "bun:test"
import type { Prisma } from "@prisma/client"
import { claimRecordedMarketingConversions, conversionId, CONVERSION_ENTITY, recordMarketingConversion, recordFirstWorkOrderConversion } from "./marketing-conversion-outbox"

const previousFlag = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED
afterEach(() => { if (previousFlag === undefined) delete process.env.NEXT_PUBLIC_ANALYTICS_ENABLED; else process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = previousFlag })
function database(orderCount = 1) {
  const rows = new Map<string, { id: string; metadataJson: string }>()
  const tx = {
    auditLog: { createMany: async ({ data }: { data: { id: string; metadataJson: string }[] }) => {
      let count = 0
      for (const row of data) if (!rows.has(row.id)) { rows.set(row.id, row); count++ }
      return { count }
    } },
    serviceOrder: { count: async () => orderCount },
    workshop: { findUnique: async () => ({ planTier: "pro" }) },
  } as unknown as Prisma.TransactionClient
  return { rows, tx }
}

describe("transactional acquisition conversions", () => {
  test("stable identity deduplicates retry and concurrent transaction attempts", async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "true"
    const { tx, rows } = database()
    const input = { name: "paid_subscription_confirmed" as const, key: "order-one", workshopId: "workshop-one", payload: { plan_tier: "pro" as const, billing_cycle: "monthly" as const } }
    await Promise.all([recordMarketingConversion(tx, input), recordMarketingConversion(tx, input)])
    expect(rows.size).toBe(1)
    expect([...rows.keys()][0]).toBe(conversionId("paid_subscription_confirmed", "order-one"))
    expect(conversionId("paid_subscription_confirmed", "order-two")).not.toBe([...rows.keys()][0])
  })
  test("disabled analytics does not persist attribution or conversions", async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "false"
    const { tx, rows } = database()
    await recordMarketingConversion(tx, { name: "paid_subscription_confirmed", key: "ws", workshopId: "ws", payload: { plan_tier: "pro", billing_cycle: "monthly" }, attribution: { campaignSource: "facebook" } })
    expect(rows.size).toBe(0)
  })
  test("only first work order creates a conversion; refresh does not create another", async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "true"
    const first = database(1)
    await recordFirstWorkOrderConversion(first.tx, "ws")
    await recordFirstWorkOrderConversion(first.tx, "ws")
    expect(first.rows.size).toBe(1)
    const later = database(2)
    await recordFirstWorkOrderConversion(later.tx, "ws")
    expect(later.rows.size).toBe(0)
  })
  test("persisted payload excludes PII and retains registration campaign", async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "true"
    const { tx, rows } = database()
    await recordMarketingConversion(tx, { name: "paid_subscription_confirmed", key: "ws", workshopId: "ws", payload: { plan_tier: "pro", billing_cycle: "monthly", email: "secret@example.com" } as never, attribution: { campaignSource: "facebook", phone: "5551234567", fbclid: "private" } })
    const json = [...rows.values()][0].metadataJson
    expect(json).toContain('"campaign_source":"facebook"')
    expect(json).not.toContain("secret")
    expect(json).not.toContain("5551234567")
    expect(json).not.toContain("private")
  })
})

describe("claimRecordedMarketingConversions", () => {
  type AuditRow = { id: string; workshopId: string; entityType: string; metadataJson: string | null }
  function claimDatabase(records: AuditRow[]) {
    const claims = new Set<string>()
    const tx = {
      auditLog: {
        findMany: async ({ where }: { where: { workshopId: string; entityType: string } }) =>
          records.filter((row) => row.workshopId === where.workshopId && row.entityType === where.entityType),
        createMany: async ({ data }: { data: { id: string }[] }) => {
          let count = 0
          for (const row of data) if (!claims.has(row.id)) { claims.add(row.id); count++ }
          return { count }
        },
      },
    } as unknown as Prisma.TransactionClient
    return { claims, tx }
  }
  const owner = { workshopId: "ws", role: "owner", mustChangePassword: false }
  const row = (id: string, name: string): AuditRow => ({
    id,
    workshopId: "ws",
    entityType: CONVERSION_ENTITY,
    metadataJson: JSON.stringify({ name, params: { plan_tier: "pro", event_id: id, event_version: 1 } }),
  })

  test("sözlükten çıkmış adlı eski kayıt atlanır, aynı partideki geçerli olay döner (#830)", async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "true"
    const { tx, claims } = claimDatabase([row("retired", "retired_event"), row("first", "first_work_order_created")])
    const events = await claimRecordedMarketingConversions(tx, owner)
    expect(events.map((event) => event.name)).toEqual(["first_work_order_created"])
    // Atlanan kayda claim yazılmaz; geçerli olay bir kez teslim edilir.
    expect([...claims]).toEqual(["first_claimed"])
    expect(await claimRecordedMarketingConversions(tx, owner)).toEqual([])
  })
})

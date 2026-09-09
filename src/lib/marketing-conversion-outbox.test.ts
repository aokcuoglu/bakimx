import { afterEach, describe, expect, test } from "bun:test"
import type { Prisma } from "@prisma/client"
import { conversionId, recordMarketingConversion, recordFirstWorkOrderConversion } from "./marketing-conversion-outbox"

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
    workshop: { findUnique: async () => ({ planTier: "lite" }) },
  } as unknown as Prisma.TransactionClient
  return { rows, tx }
}

describe("transactional acquisition conversions", () => {
  test("stable identity deduplicates retry and concurrent transaction attempts", async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "true"
    const { tx, rows } = database()
    const input = { name: "lite_registered" as const, key: "workshop-one", workshopId: "workshop-one", payload: { plan_tier: "lite" as const } }
    await Promise.all([recordMarketingConversion(tx, input), recordMarketingConversion(tx, input)])
    expect(rows.size).toBe(1)
    expect([...rows.keys()][0]).toBe(conversionId("lite_registered", "workshop-one"))
    expect(conversionId("lite_registered", "workshop-two")).not.toBe([...rows.keys()][0])
  })
  test("disabled analytics does not persist attribution or conversions", async () => {
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "false"
    const { tx, rows } = database()
    await recordMarketingConversion(tx, { name: "lite_registered", key: "ws", workshopId: "ws", payload: { plan_tier: "lite" }, attribution: { campaignSource: "facebook" } })
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
    await recordMarketingConversion(tx, { name: "lite_registered", key: "ws", workshopId: "ws", payload: { plan_tier: "lite", email: "secret@example.com" } as never, attribution: { campaignSource: "facebook", phone: "5551234567", fbclid: "private" } })
    const json = [...rows.values()][0].metadataJson
    expect(json).toContain('"campaign_source":"facebook"')
    expect(json).not.toContain("secret")
    expect(json).not.toContain("5551234567")
    expect(json).not.toContain("private")
  })
})

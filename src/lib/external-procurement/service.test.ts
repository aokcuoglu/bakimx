import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { procurementRequestHash } from "./service"

const root = join(import.meta.dir, "../../..")
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8")
const migration = readFileSync(join(root, "prisma/migrations/20260821233000_add_external_procurement/migration.sql"), "utf8")
const service = readFileSync(join(import.meta.dir, "service.ts"), "utf8")

const input = {
  workshopId: "ws-a", serviceOrderId: "order-a", serviceOrderItemId: "item-a",
  requestedByUserId: "user-a", idempotencyKey: "key-a", externalProductId: "p1",
  externalOfferId: "offer_1", quantity: 1, expectedUnitNetKurus: 1000,
  productPresentation: { name: "Filtre" },
}

describe("external procurement guardrails", () => {
  test("idempotency identity includes payload but excludes presentation-only fields", () => {
    expect(procurementRequestHash(input)).toBe(procurementRequestHash({ ...input, productPresentation: { name: "Yeni ad" } }))
    expect(procurementRequestHash(input)).not.toBe(procurementRequestHash({ ...input, quantity: 2 }))
  })

  test("schema is additive, provider-neutral, and does not alter OrderItemSource", () => {
    expect(schema).toContain("model ExternalProcurementOrder")
    expect(schema).toContain("@@unique([provider, workshopId, idempotencyKey])")
    expect(migration).not.toContain("ALTER TYPE")
    expect(migration).not.toMatch(/supplierCost|netCost|margin|rawPayload|secret/i)
  })

  test("tenant linkage and no-local-stock invariant are enforced before provider I/O", () => {
    expect(service).toContain('requireWritableWorkshop("parts.purchase")')
    expect(service).toContain("serviceOrder: { workshopId: input.workshopId }")
    expect(service).toContain("item.partId !== null")
    expect(service).not.toMatch(/stockMovement|partStockItem\.(update|create)/)
  })

  test("projection rejects stale versions and provider identity is client-owned", () => {
    expect(service).toContain("partnerVersion: { lt: remote.version }")
    expect(service).toContain("provider: client.provider")
  })
})

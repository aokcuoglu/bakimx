import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  applyExternalProcurementProjection,
  pollCompletionGuard,
  procurementRequestHash,
  reconcileBackoffMs,
} from "./service"
import type { ProcurementOrder } from "./types"

const root = join(import.meta.dir, "../../..")
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8")
const migration = readFileSync(join(root, "prisma/migrations/20260821233000_add_external_procurement/migration.sql"), "utf8")
const service = readFileSync(join(import.meta.dir, "service.ts"), "utf8")

const input = {
  workshopId: "ws-a", serviceOrderId: "order-a", serviceOrderItemId: "item-a",
  requestedByUserId: "user-a", idempotencyKey: "key-a", externalProductId: "p1",
  externalOfferId: "offer_1", quantity: 1, expectedUnitNetKurus: 1000,
  expectedPolicyVersion: "v1", expectedExpiresAt: "2026-08-21T21:00:00.000Z",
  productPresentation: { name: "Filtre" },
}

const remoteOrder: ProcurementOrder = {
  id: "remote-1", status: "CONFIRMED", version: 4,
  bindingPrice: { netKurus: 1000, vatKurus: 200, grossKurus: 1200, currency: "TRY", policyVersion: "v1", expiresAt: "2026-08-21T21:00:00.000Z" },
  items: [{ sourceProductId: "p1", selectedOfferId: "o1", quantity: 1, unitNetKurus: 1000, unitVatKurus: 200, unitGrossKurus: 1200 }],
  cancellationRequested: false, createdAt: "2026-08-21T20:00:00.000Z", updatedAt: "2026-08-21T20:01:00.000Z",
}

describe("external procurement guardrails", () => {
  test("idempotency identity includes payload but excludes presentation-only fields", () => {
    expect(procurementRequestHash(input)).toBe(procurementRequestHash({ ...input, productPresentation: { name: "Yeni ad" } }))
    expect(procurementRequestHash(input)).not.toBe(procurementRequestHash({ ...input, quantity: 2 }))
    expect(procurementRequestHash(input)).not.toBe(procurementRequestHash({ ...input, expectedPolicyVersion: "v2" }))
    expect(procurementRequestHash(input)).not.toBe(procurementRequestHash({ ...input, expectedExpiresAt: "2026-08-21T21:01:00.000Z" }))
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

  test("all projection paths share an atomic monotonic projector", () => {
    expect(service).toContain("applyExternalProcurementProjection")
    expect(service).toContain("partnerVersion: { lt: order.version }")
    expect(service).toContain("externalProcurementOrderItem.updateMany")
    expect(service).toContain("provider: client.provider")
  })

  test("projector applies a newer parent and item together, but ignores stale/equal versions", async () => {
    const calls: string[] = []
    const newerTx = {
      externalProcurementOrder: {
        findUnique: async () => ({ externalOrderId: "remote-1", partnerVersion: 3, cancellationRequestedAt: null }),
        updateMany: async () => { calls.push("parent"); return { count: 1 } },
      },
      externalProcurementOrderItem: {
        updateMany: async () => { calls.push("item"); return { count: 1 } },
      },
    } as unknown as Parameters<typeof applyExternalProcurementProjection>[0]
    expect(await applyExternalProcurementProjection(newerTx, "local-1", remoteOrder)).toBe(true)
    expect(calls).toEqual(["parent", "item"])

    const staleCalls: string[] = []
    const staleTx = {
      externalProcurementOrder: {
        findUnique: async () => ({ externalOrderId: "remote-1", partnerVersion: 4, cancellationRequestedAt: null }),
        updateMany: async () => { staleCalls.push("parent"); return { count: 1 } },
      },
      externalProcurementOrderItem: {
        updateMany: async () => { staleCalls.push("item"); return { count: 1 } },
      },
    } as unknown as Parameters<typeof applyExternalProcurementProjection>[0]
    expect(await applyExternalProcurementProjection(staleTx, "local-1", remoteOrder)).toBe(false)
    expect(staleCalls).toEqual([])
  })

  test("polling backoff is bounded", () => {
    expect(reconcileBackoffMs(1)).toBe(60_000)
    expect(reconcileBackoffMs(3)).toBe(240_000)
    expect(reconcileBackoffMs(100)).toBe(3_600_000)
  })

  test("poll completion is guarded by the exact claimed version and lease", () => {
    const lease = new Date("2026-08-21T20:02:00.000Z")
    expect(pollCompletionGuard({ id: "local-1", partnerVersion: 4 }, lease)).toEqual({
      id: "local-1", partnerVersion: 4, nextReconcileAt: lease,
    })
  })

  test("schema contains durable event dedupe and manual reconciliation signals", () => {
    expect(schema).toContain("model ExternalProcurementEvent")
    expect(schema).toContain("@@unique([provider, eventId])")
    expect(schema).toContain("manualReconcileRequiredAt")
    expect(migration).not.toMatch(/rawPayload|secret/i)
  })
})

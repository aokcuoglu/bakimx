import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  applyExternalProcurementProjection,
  itemProjections,
  pollCompletionGuard,
  procurementCancellationCode,
  procurementOrderRevision,
  procurementRequestHash,
  reconcileBackoffMs,
  sweepExternalProcurements,
} from "./service"
import { contractOrder, contractShippingAddress } from "./contract-v2.fixtures"
import type { ProcurementOrder, ProcurementProviderClient } from "./types"
import { releasesProcurementAttempt, requiresProcurementReconfirmation } from "./types"

const root = join(import.meta.dir, "../../..")
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8")
const migration = readFileSync(join(root, "prisma/migrations/20260821233000_add_external_procurement/migration.sql"), "utf8")
const service = readFileSync(join(import.meta.dir, "service.ts"), "utf8")

const input = {
  workshopId: "ws-a", serviceOrderId: "order-a", serviceOrderItemId: "item-a",
  requestedByUserId: "user-a", idempotencyKey: "key-a", externalProductId: "p1",
  externalOfferId: "offer_1", quantity: 1, expectedUnitNetKurus: 1000,
  confirmationToken: "opaque-confirmation-token-a",
  shippingAddress: contractShippingAddress,
  productPresentation: { name: "Filtre" },
}

const remoteOrder = { ...contractOrder, status: "CONFIRMED" } as ProcurementOrder

describe("external procurement guardrails", () => {
  test("idempotency identity includes payload but excludes presentation-only fields", () => {
    expect(procurementRequestHash(input)).toBe(procurementRequestHash({ ...input, productPresentation: { name: "Yeni ad" } }))
    expect(procurementRequestHash(input)).not.toBe(procurementRequestHash({ ...input, quantity: 2 }))
    expect(procurementRequestHash(input)).not.toBe(procurementRequestHash({ ...input, confirmationToken: "opaque-confirmation-token-b" }))
    expect(procurementRequestHash(input)).not.toBe(procurementRequestHash({ ...input, shippingAddress: { ...contractShippingAddress, district: "Üsküdar" } }))
  })

  test("maps v2.0 quote conflicts to the reconfirmation path", () => {
    for (const code of ["PRICE_CHANGED", "QUOTE_CHANGED", "QUOTE_EXPIRED"]) {
      expect(requiresProcurementReconfirmation(code)).toBe(true)
    }
    for (const code of ["PROVIDER_UNAVAILABLE", "OFFER_UNAVAILABLE", "CREDIT_LIMIT_EXCEEDED"]) {
      expect(requiresProcurementReconfirmation(code)).toBe(false)
    }
  })

  test("releases the local attempt on every definite creation rejection except IDEMPOTENCY_CONFLICT", () => {
    for (const code of ["OFFER_UNAVAILABLE", "QUANTITY_UNAVAILABLE", "PRICE_CHANGED", "QUOTE_EXPIRED", "QUOTE_CHANGED", "CREDIT_LIMIT_EXCEEDED"]) {
      expect(releasesProcurementAttempt({ code, status: 409, retryable: false })).toBe(true)
    }
    expect(releasesProcurementAttempt({ code: "VALIDATION_ERROR", status: 400, retryable: false })).toBe(true)
    expect(releasesProcurementAttempt({ code: "IDEMPOTENCY_CONFLICT", status: 409, retryable: false })).toBe(false)
    expect(releasesProcurementAttempt({ code: "ORDER_INTAKE_PAUSED", status: 503, retryable: false })).toBe(true)
    // Ambiguous: the order may exist; it is reconciled by key instead.
    expect(releasesProcurementAttempt({ code: "SUPPLIER_CHECK_UNAVAILABLE", status: 503, retryable: true })).toBe(false)
    expect(releasesProcurementAttempt({ code: "INVALID_PROVIDER_RESPONSE", retryable: false })).toBe(false)
  })

  test("derives a revision every contract transition strictly raises", () => {
    const at = (patch: Partial<ProcurementOrder>) => procurementOrderRevision({ ...remoteOrder, ...patch })
    const shipment = { carrier: "Yurtiçi Kargo", trackingNo: "1", trackingUrl: null, shippedAt: "2026-11-19T08:00:00.000Z", deliveredAt: null }
    const pending = { status: "PENDING" as const, requestedAt: "2026-11-18T11:00:00.000Z", decidedAt: null }
    const rejected = { ...pending, status: "REJECTED" as const, decidedAt: "2026-11-18T12:00:00.000Z" }
    const approved = { ...rejected, status: "APPROVED" as const }
    const paths = [
      [at({ status: "REQUESTED" }), at({ status: "CONFIRMED" }), at({ status: "SHIPPED", shipment }), at({ status: "COMPLETED", shipment })],
      [at({ status: "REQUESTED" }), at({ status: "CANCELLED", cancelledBy: "PARTNER" })],
      [at({ status: "CONFIRMED" }), at({ status: "CONFIRMED", cancellationRequest: pending }), at({ status: "CANCELLED", cancellationRequest: approved })],
      [at({ status: "CONFIRMED", cancellationRequest: pending }), at({ status: "CONFIRMED", cancellationRequest: rejected }), at({ status: "SHIPPED", cancellationRequest: rejected, shipment })],
    ]
    for (const path of paths) {
      for (let index = 1; index < path.length; index += 1) expect(path[index]).toBeGreaterThan(path[index - 1])
    }
  })

  test("summarises cancellation state in the existing cancellationCode column", () => {
    expect(procurementCancellationCode(remoteOrder)).toBeNull()
    expect(procurementCancellationCode({ ...remoteOrder, status: "CANCELLED", cancelledBy: "GETIRBAKIM" })).toBe("CANCELLED_BY_GETIRBAKIM")
    expect(procurementCancellationCode({ ...remoteOrder, status: "CANCELLED", cancelledBy: "PARTNER" })).toBe("CANCELLED_BY_PARTNER")
    expect(procurementCancellationCode({ ...remoteOrder, cancellationRequest: { status: "PENDING", requestedAt: "2026-11-18T11:00:00.000Z", decidedAt: null } })).toBe("REQUEST_PENDING")
    expect(procurementCancellationCode({ ...remoteOrder, cancellationRequest: { status: "REJECTED", requestedAt: "2026-11-18T11:00:00.000Z", decidedAt: "2026-11-18T12:00:00.000Z" } })).toBe("REQUEST_REJECTED")
  })

  test("projects each contract line onto its local item by offer id", () => {
    expect(itemProjections(remoteOrder)).toEqual([{
      externalOfferId: contractOrder.lines[0].selectedOfferId,
      data: { quantity: 2, unitNetKurus: 13000, unitVatKurus: 2600, unitGrossKurus: 15600 },
    }])
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
    expect(service).toContain("partnerVersion: { lt: revision }")
    expect(service).toContain("externalProcurementOrderItem.updateMany")
    expect(service).toContain("provider: client.provider")
  })

  test("projector applies a newer parent and item together, but ignores stale/equal versions", async () => {
    const calls: string[] = []
    let projected: Record<string, unknown> = {}
    const newerTx = {
      externalProcurementOrder: {
        findUnique: async () => ({ externalOrderId: contractOrder.id, partnerVersion: 100 }),
        updateMany: async ({ data }: { data: Record<string, unknown> }) => { calls.push("parent"); projected = data; return { count: 1 } },
      },
      externalProcurementOrderItem: {
        updateMany: async () => { calls.push("item"); return { count: 1 } },
      },
    } as unknown as Parameters<typeof applyExternalProcurementProjection>[0]
    expect(await applyExternalProcurementProjection(newerTx, "local-1", remoteOrder)).toBe(true)
    expect(calls).toEqual(["parent", "item"])
    expect(projected).toMatchObject({
      partnerStatus: "CONFIRMED", partnerVersion: 200, pricingPolicyVersion: "2.0", reservationExpiresAt: null,
      // Gross carries the shipping fee: 26000 + 5200 + 5000.
      bindingNetKurus: 26000, bindingVatKurus: 5200, bindingGrossKurus: 36200, cancellationCode: null,
    })

    const staleCalls: string[] = []
    const staleTx = {
      externalProcurementOrder: {
        findUnique: async () => ({ externalOrderId: contractOrder.id, partnerVersion: 200 }),
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

  test("scheduled reconciliation resolves an ambiguous initiation by its persisted key", async () => {
    const calls: string[] = []
    const row = { id: "local-1", idempotencyKey: "attempt-1", createdAt: new Date("2026-08-21T20:00:00Z"), externalOrderId: null, partnerVersion: 0, reconcileFailureCount: 0 }
    const database = {
      externalProcurementOrder: {
        findMany: async () => [row],
        updateMany: async () => ({ count: 1 }),
      },
      $transaction: async (fn: (tx: unknown) => Promise<boolean>) => fn({
        externalProcurementOrder: {
          findUnique: async () => ({ externalOrderId: null, partnerVersion: 0 }),
          updateMany: async () => { calls.push("parent"); return { count: 1 } },
        },
        externalProcurementOrderItem: { updateMany: async () => { calls.push("item"); return { count: 1 } } },
      }),
    } as unknown as Parameters<typeof sweepExternalProcurements>[2]
    const client = {
      provider: "getirbakim",
      getOrderByIdempotencyKey: async (key: string) => {
        expect(key).toBe("attempt-1")
        return { ...remoteOrder, status: "REQUESTED" as const }
      },
    } as ProcurementProviderClient
    expect(await sweepExternalProcurements(client, { now: new Date("2026-08-21T20:01:00Z") }, database)).toEqual({ processed: 1, applied: 1, failed: 0 })
    expect(calls).toEqual(["parent", "item"])
  })

  test("an authoritative missing result releases an old unresolved item", async () => {
    let released = false
    const row = { id: "local-1", idempotencyKey: "attempt-1", createdAt: new Date("2026-08-21T18:00:00Z"), externalOrderId: null, partnerVersion: 0, reconcileFailureCount: 0 }
    const database = { externalProcurementOrder: {
      findMany: async () => [row], updateMany: async () => ({ count: 1 }),
      deleteMany: async (input: { where: { partnerStatus: string; externalOrderId: null } }) => {
        expect(input.where).toMatchObject({ partnerStatus: "INITIATING", externalOrderId: null })
        released = true
        return { count: 1 }
      },
    } } as unknown as Parameters<typeof sweepExternalProcurements>[2]
    const client = { provider: "getirbakim", getOrderByIdempotencyKey: async () => null } as unknown as ProcurementProviderClient
    expect(await sweepExternalProcurements(client, { now: new Date("2026-08-21T20:01:00Z") }, database)).toEqual({ processed: 1, applied: 0, failed: 0 })
    expect(released).toBe(true)
  })

  test("schema contains durable event dedupe and manual reconciliation signals", () => {
    expect(schema).toContain("model ExternalProcurementEvent")
    expect(schema).toContain("@@unique([provider, eventId])")
    expect(schema).toContain("manualReconcileRequiredAt")
    expect(migration).not.toMatch(/rawPayload|secret/i)
  })
})

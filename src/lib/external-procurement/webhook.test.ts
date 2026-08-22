import { createHmac } from "node:crypto"
import { describe, expect, test } from "bun:test"
import {
  DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
  processProcurementWebhook,
  procurementWebhookSchema,
  validateProcurementWebhookEnvelope,
  verifyProcurementWebhook,
} from "./webhook"
import { applyExternalProcurementProjection, pollCompletionGuard } from "./service"
import type { ProcurementOrder, ProcurementStatus } from "./types"

const secret = "test-webhook-secret"
const timestamp = "1787342400"
const nowMs = Number(timestamp) * 1000
const body = '{"type":"order.updated","order":{"id":"remote-1"}}'
const order = {
  contractVersion: "1.0", id: "remote-1", status: "REQUESTED", version: 1,
  bindingPrice: { netKurus: 1000, vatKurus: 200, grossKurus: 1200, currency: "TRY", policyVersion: "v1", expiresAt: "2026-08-21T21:00:00.000Z" },
  items: [{ sourceProductId: "p1", selectedOfferId: "o1", quantity: 1, unitNetKurus: 1000, unitVatKurus: 200, unitGrossKurus: 1200 }],
  cancellationRequested: false, createdAt: "2026-08-21T20:00:00.000Z", updatedAt: "2026-08-21T20:00:00.000Z",
}
const envelope = procurementWebhookSchema.parse({
  specVersion: "1.0", eventId: "evt-1", eventType: "partner.order.updated",
  occurredAt: "2026-08-21T20:01:00.000Z", partnerId: "bakimx", order,
})

function lifecycleEnvelope(eventId: string, version: number, status: ProcurementStatus, orderId = "remote-1") {
  return procurementWebhookSchema.parse({
    ...envelope, eventId,
    occurredAt: new Date(Date.parse(envelope.occurredAt) + version * 1000).toISOString(),
    order: { ...order, id: orderId, version, status },
  })
}

function sign(rawBody: string, at = timestamp) {
  return createHmac("sha256", secret).update(`${at}.${rawBody}`).digest("hex")
}

describe("procurement webhook verification", () => {
  test("verifies the exact timestamp-dot-raw-body bytes", () => {
    expect(verifyProcurementWebhook({ rawBody: body, timestamp, signature: sign(body), secret, nowMs })).toEqual({ ok: true })
    expect(verifyProcurementWebhook({ rawBody: `${body}\n`, timestamp, signature: sign(body), secret, nowMs })).toEqual({ ok: false, code: "invalid_signature" })
  })

  test("accepts the v1 prefix and rejects malformed signatures", () => {
    expect(verifyProcurementWebhook({ rawBody: body, timestamp, signature: `v1=${sign(body)}`, secret, nowMs })).toEqual({ ok: true })
    expect(verifyProcurementWebhook({ rawBody: body, timestamp, signature: "v1=nope", secret, nowMs })).toEqual({ ok: false, code: "invalid_signature" })
  })

  test("rejects timestamps outside the replay window in either direction", () => {
    for (const delta of [-DEFAULT_WEBHOOK_TOLERANCE_SECONDS - 1, DEFAULT_WEBHOOK_TOLERANCE_SECONDS + 1]) {
      const stale = String(Number(timestamp) + delta)
      expect(verifyProcurementWebhook({ rawBody: body, timestamp: stale, signature: sign(body, stale), secret, nowMs })).toEqual({ ok: false, code: "stale_timestamp" })
    }
  })

  test("accepts only the sender's strict versioned envelope", () => {
    expect(validateProcurementWebhookEnvelope(envelope, { eventId: "evt-1", version: "1.0", partnerId: "bakimx" })).toBeNull()
    expect(validateProcurementWebhookEnvelope(envelope, { eventId: "evt-2", version: "1.0", partnerId: "bakimx" })).toBe("event_id_mismatch")
    expect(validateProcurementWebhookEnvelope(envelope, { eventId: "evt-1", version: "2.0", partnerId: "bakimx" })).toBe("version_mismatch")
    expect(validateProcurementWebhookEnvelope(envelope, { eventId: "evt-1", version: "1.0", partnerId: "other" })).toBe("partner_mismatch")
    expect(procurementWebhookSchema.safeParse({ ...envelope, extra: true }).success).toBe(false)
  })

  test("dedupes a persisted event unique conflict", async () => {
    const database = {
      $transaction: async () => { throw { code: "P2002", meta: { target: ["provider", "eventId"] } } },
    } as unknown as Parameters<typeof processProcurementWebhook>[1]
    await expect(processProcurementWebhook({ provider: "getirbakim", eventId: "evt-1", contractVersion: "1.0", event: envelope }, database)).resolves.toEqual({
      status: "duplicate", applied: false,
    })
  })

  test("persists an authenticated unknown-order event as poison for manual review", async () => {
    const updates: Array<Record<string, unknown>> = []
    const tx = {
      externalProcurementEvent: {
        create: async () => ({ id: "inbox-1" }),
        update: async (input: Record<string, unknown>) => { updates.push(input); return input },
      },
      externalProcurementOrder: { findFirst: async () => null },
    }
    const database = {
      $transaction: async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    } as unknown as Parameters<typeof processProcurementWebhook>[1]
    const result = await processProcurementWebhook({ provider: "getirbakim", eventId: "evt-1", contractVersion: "1.0", event: envelope }, database)
    expect(result).toMatchObject({ status: "failed", applied: false, failureCode: "ORDER_NOT_FOUND" })
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({ data: { status: "failed", failureCode: "ORDER_NOT_FOUND" } })
  })

  test("runs signed sender envelopes through lifecycle, dedupe, stale, poison, and poll race", async () => {
    const inbox = new Map<string, Record<string, unknown>>()
    const state: Record<string, unknown> = {
      id: "local-1", externalOrderId: "remote-1", partnerVersion: 1,
      cancellationRequestedAt: null, nextReconcileAt: null,
    }
    let itemVersion = 1
    const tx = {
      externalProcurementEvent: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const key = `${data.provider}:${data.eventId}`
          if (inbox.has(key)) throw { code: "P2002", meta: { target: ["provider", "eventId"] } }
          const row = { id: `inbox-${inbox.size + 1}`, ...data }
          inbox.set(key, row)
          return row
        },
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const entry = [...inbox.entries()].find(([, value]) => value.id === where.id)
          if (!entry) throw new Error("inbox row missing")
          Object.assign(entry[1], data)
          return entry[1]
        },
      },
      externalProcurementOrder: {
        findFirst: async ({ where }: { where: { externalOrderId: string } }) => where.externalOrderId === state.externalOrderId ? { id: state.id } : null,
        findUnique: async () => ({
          externalOrderId: state.externalOrderId,
          partnerVersion: state.partnerVersion,
          cancellationRequestedAt: state.cancellationRequestedAt,
        }),
        updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
          if (where.id !== state.id) return { count: 0 }
          if ("externalOrderId" in where && where.externalOrderId !== state.externalOrderId) return { count: 0 }
          if (typeof where.partnerVersion === "number" && where.partnerVersion !== state.partnerVersion) return { count: 0 }
          if (where.nextReconcileAt instanceof Date && (state.nextReconcileAt as Date | null)?.getTime() !== where.nextReconcileAt.getTime()) return { count: 0 }
          const versionFilter = where.partnerVersion as { lt?: number; lte?: number } | undefined
          if (versionFilter?.lt !== undefined && Number(state.partnerVersion) >= versionFilter.lt) return { count: 0 }
          if (versionFilter?.lte !== undefined && Number(state.partnerVersion) > versionFilter.lte) return { count: 0 }
          Object.assign(state, data)
          return { count: 1 }
        },
      },
      externalProcurementOrderItem: {
        updateMany: async () => { itemVersion = Number(state.partnerVersion); return { count: 1 } },
      },
    }
    const database = {
      $transaction: async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    } as unknown as Parameters<typeof processProcurementWebhook>[1]
    const typedTx = tx as unknown as Parameters<typeof applyExternalProcurementProjection>[0]

    async function deliver(event: ReturnType<typeof lifecycleEnvelope>) {
      const rawBody = JSON.stringify(event)
      const signature = sign(rawBody)
      expect(verifyProcurementWebhook({ rawBody, timestamp, signature: `v1=${signature}`, secret, nowMs })).toEqual({ ok: true })
      const parsed = procurementWebhookSchema.parse(JSON.parse(rawBody))
      expect(validateProcurementWebhookEnvelope(parsed, { eventId: event.eventId, version: "1.0", partnerId: "bakimx" })).toBeNull()
      return processProcurementWebhook({ provider: "getirbakim", eventId: event.eventId, contractVersion: "1.0", event: parsed }, database)
    }

    expect(await deliver(lifecycleEnvelope("evt-confirmed", 2, "CONFIRMED"))).toMatchObject({ status: "processed", applied: true })
    expect(await deliver(lifecycleEnvelope("evt-shipped", 3, "SHIPPED"))).toMatchObject({ status: "processed", applied: true })
    expect(state.partnerVersion).toBe(3)
    expect(itemVersion).toBe(3)
    expect(await deliver(lifecycleEnvelope("evt-shipped", 3, "SHIPPED"))).toMatchObject({ status: "duplicate", applied: false })
    expect(await deliver(lifecycleEnvelope("evt-late", 2, "CONFIRMED"))).toMatchObject({ status: "ignored_stale", applied: false })
    expect(state.partnerVersion).toBe(3)
    expect(await deliver(lifecycleEnvelope("evt-poison", 1, "REQUESTED", "unknown-order"))).toMatchObject({ status: "failed", failureCode: "ORDER_NOT_FOUND" })

    const lease = new Date("2026-08-21T20:10:00.000Z")
    state.nextReconcileAt = lease
    const polledV4 = lifecycleEnvelope("unused-poll", 4, "SHIPPED").order as ProcurementOrder
    expect(await deliver(lifecycleEnvelope("evt-completed", 5, "COMPLETED"))).toMatchObject({ status: "processed", applied: true })
    expect(await applyExternalProcurementProjection(typedTx, "local-1", polledV4)).toBe(false)
    const stalePollCompletion = await tx.externalProcurementOrder.updateMany({
      where: pollCompletionGuard({ id: "local-1", partnerVersion: 3 }, lease),
      data: { lastReconcileError: null, nextReconcileAt: new Date() },
    })
    expect(stalePollCompletion.count).toBe(0)
    expect(state.partnerVersion).toBe(5)
    expect(state.nextReconcileAt).toBeNull()
  })
})

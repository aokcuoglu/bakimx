import { createHmac } from "node:crypto"
import { describe, expect, test } from "bun:test"
import {
  DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
  parseGetirbakimWebhook,
  processProcurementWebhook,
  procurementWebhookSchema,
  recordUnsupportedProcurementWebhook,
  validateProcurementWebhookEnvelope,
  verifyProcurementWebhook,
} from "./webhook"
import { applyExternalProcurementProjection, pollCompletionGuard } from "./service"
import { contractOrder } from "./contract-v2.fixtures"
import type { ProcurementOrder, ProcurementStatus } from "./types"

const secret = "test-webhook-secret"
const timestamp = "1787342400"
const nowMs = Number(timestamp) * 1000
const body = '{"type":"order.updated","order":{"id":"remote-1"}}'
const order = { ...contractOrder, id: "remote-1" }
const envelope = procurementWebhookSchema.parse({
  specVersion: "1.0", eventId: "evt-1", eventType: "partner.order.updated",
  occurredAt: "2026-08-21T20:01:00.000Z", partnerId: "bakimx", order,
})

const STATUS_STEP: Record<ProcurementStatus, number> = { REQUESTED: 1, CONFIRMED: 2, SHIPPED: 3, COMPLETED: 4, CANCELLED: 5 }

function lifecycleEnvelope(eventId: string, status: ProcurementStatus, orderId = "remote-1") {
  return procurementWebhookSchema.parse({
    ...envelope, eventId,
    occurredAt: new Date(Date.parse(envelope.occurredAt) + STATUS_STEP[status] * 1000).toISOString(),
    order: { ...order, id: orderId, status },
  })
}

function sign(rawBody: string, at = timestamp) {
  return `v1=${createHmac("sha256", secret).update(`${at}.${rawBody}`).digest("hex")}`
}

describe("procurement webhook verification", () => {
  test("verifies the exact timestamp-dot-raw-body bytes", () => {
    expect(verifyProcurementWebhook({ rawBody: body, timestamp, signature: sign(body), secret, nowMs })).toEqual({ ok: true })
    expect(verifyProcurementWebhook({ rawBody: `${body}\n`, timestamp, signature: sign(body), secret, nowMs })).toEqual({ ok: false, code: "invalid_signature" })
  })

  test("requires the v1= scheme and rejects malformed signatures", () => {
    expect(verifyProcurementWebhook({ rawBody: body, timestamp, signature: sign(body).slice(3), secret, nowMs })).toEqual({ ok: false, code: "invalid_signature" })
    expect(verifyProcurementWebhook({ rawBody: body, timestamp, signature: "v1=nope", secret, nowMs })).toEqual({ ok: false, code: "invalid_signature" })
  })

  test("rejects timestamps outside the replay window in either direction", () => {
    for (const delta of [-DEFAULT_WEBHOOK_TOLERANCE_SECONDS - 1, DEFAULT_WEBHOOK_TOLERANCE_SECONDS + 1]) {
      const stale = String(Number(timestamp) + delta)
      expect(verifyProcurementWebhook({ rawBody: body, timestamp: stale, signature: sign(body, stale), secret, nowMs })).toEqual({ ok: false, code: "stale_timestamp" })
    }
  })

  test("matches GetirBakim's signPartnerWebhook test vector byte for byte", () => {
    // getirbakim scripts/test-partner.ts: signPartnerWebhook(secret, "1767225600", '{"eventId":"e1"}').
    const vector = {
      rawBody: '{"eventId":"e1"}', timestamp: "1767225600", secret: "test-webhook-secret-0123456789abcdef",
      signature: "v1=3d23b84b1e6c09b71354f18c44be04f6c4cce3dae971a0304540f9f44315d567",
    }
    expect(verifyProcurementWebhook({ ...vector, nowMs: 1767225600_000 })).toEqual({ ok: true })
    expect(verifyProcurementWebhook({ ...vector, rawBody: '{"eventId":"e2"}', nowMs: 1767225600_000 })).toEqual({ ok: false, code: "invalid_signature" })
    // A bare hex digest (no v1= scheme) is not the contract's format.
    expect(verifyProcurementWebhook({ ...vector, signature: vector.signature.slice(3), nowMs: 1767225600_000 })).toEqual({ ok: false, code: "invalid_signature" })
  })

  test("routes on the body's eventType and checks the envelope against headers and receiver", () => {
    expect(parseGetirbakimWebhook(JSON.parse(JSON.stringify(envelope)))).toMatchObject({ kind: "order", event: { eventId: "evt-1" } })
    const expected = { eventId: "evt-1", eventType: "partner.order.updated", partnerId: "bakimx" }
    expect(validateProcurementWebhookEnvelope(envelope, expected)).toBeNull()
    expect(validateProcurementWebhookEnvelope(envelope, { ...expected, eventId: "evt-2" })).toBe("event_id_mismatch")
    expect(validateProcurementWebhookEnvelope(envelope, { ...expected, eventType: "partner.return.updated" })).toBe("event_type_mismatch")
    expect(validateProcurementWebhookEnvelope(envelope, { ...expected, partnerId: "other" })).toBe("partner_mismatch")
    // Strict order envelope: an unknown field, another specVersion or a broken Order is not the contract.
    expect(parseGetirbakimWebhook({ ...envelope, extra: true })).toBeNull()
    expect(parseGetirbakimWebhook({ ...envelope, specVersion: "2.0" })).toBeNull()
    expect(parseGetirbakimWebhook({ ...envelope, order: { ...order, status: "RESERVATION_EXPIRED" } })).toBeNull()
  })

  test("accepts return and unknown event types as unsupported", () => {
    const returnEvent = {
      specVersion: "1.0", eventId: "evt-return", eventType: "partner.return.updated", occurredAt: "2026-11-21T11:00:00.000Z", partnerId: "bakimx",
      return: { contractVersion: "2.1", id: "ret-1", orderId: "remote-1", status: "APPROVED", lines: [], decidedAt: "2026-11-21T11:00:00.000Z" },
    }
    expect(parseGetirbakimWebhook(returnEvent)).toEqual({
      kind: "unsupported", eventId: "evt-return", eventType: "partner.return.updated", specVersion: "1.0", partnerId: "bakimx", externalOrderId: "remote-1",
    })
    expect(parseGetirbakimWebhook({ ...returnEvent, return: { id: "ret-1" } })).toBeNull()
    const future = { specVersion: "1.0", eventId: "evt-x", eventType: "partner.invoice.created", occurredAt: "2026-11-21T11:00:00.000Z", partnerId: "bakimx", invoice: {} }
    expect(parseGetirbakimWebhook(future)).toMatchObject({ kind: "unsupported", eventType: "partner.invoice.created", externalOrderId: "" })
  })

  test("records an unsupported event once and dedupes its eventId", async () => {
    const rows = new Map<string, Record<string, unknown>>()
    const database = {
      externalProcurementEvent: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const key = `${data.provider}:${data.eventId}`
          if (rows.has(key)) throw { code: "P2002", meta: { target: ["provider", "eventId"] } }
          rows.set(key, data)
          return data
        },
      },
    } as unknown as Parameters<typeof recordUnsupportedProcurementWebhook>[1]
    const input = { provider: "getirbakim", eventId: "evt-return", contractVersion: "1.0", eventType: "partner.return.updated", externalOrderId: "remote-1" }
    expect(await recordUnsupportedProcurementWebhook(input, database)).toEqual({ status: "ignored_unsupported", applied: false })
    expect(await recordUnsupportedProcurementWebhook(input, database)).toEqual({ status: "duplicate", applied: false })
    expect(rows.get("getirbakim:evt-return")).toMatchObject({ status: "ignored_unsupported", partnerVersion: 0, externalOrderId: "remote-1" })
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
      expect(verifyProcurementWebhook({ rawBody, timestamp, signature, secret, nowMs })).toEqual({ ok: true })
      const parsed = parseGetirbakimWebhook(JSON.parse(rawBody))
      if (parsed?.kind !== "order") throw new Error("expected an order event")
      expect(validateProcurementWebhookEnvelope(parsed.event, { eventId: event.eventId, eventType: "partner.order.updated", partnerId: "bakimx" })).toBeNull()
      return processProcurementWebhook({ provider: "getirbakim", eventId: event.eventId, contractVersion: "1.0", event: parsed.event }, database)
    }

    expect(await deliver(lifecycleEnvelope("evt-confirmed", "CONFIRMED"))).toMatchObject({ status: "processed", applied: true })
    expect(await deliver(lifecycleEnvelope("evt-shipped", "SHIPPED"))).toMatchObject({ status: "processed", applied: true })
    expect(state.partnerVersion).toBe(300)
    expect(itemVersion).toBe(300)
    expect(await deliver(lifecycleEnvelope("evt-shipped", "SHIPPED"))).toMatchObject({ status: "duplicate", applied: false })
    expect(await deliver(lifecycleEnvelope("evt-late", "CONFIRMED"))).toMatchObject({ status: "ignored_stale", applied: false })
    expect(state.partnerVersion).toBe(300)
    expect(await deliver(lifecycleEnvelope("evt-poison", "REQUESTED", "unknown-order"))).toMatchObject({ status: "failed", failureCode: "ORDER_NOT_FOUND" })

    const lease = new Date("2026-08-21T20:10:00.000Z")
    state.nextReconcileAt = lease
    const polledShipped = lifecycleEnvelope("unused-poll", "SHIPPED").order as ProcurementOrder
    expect(await deliver(lifecycleEnvelope("evt-completed", "COMPLETED"))).toMatchObject({ status: "processed", applied: true })
    expect(await applyExternalProcurementProjection(typedTx, "local-1", polledShipped)).toBe(false)
    const stalePollCompletion = await tx.externalProcurementOrder.updateMany({
      where: pollCompletionGuard({ id: "local-1", partnerVersion: 300 }, lease),
      data: { lastReconcileError: null, nextReconcileAt: new Date() },
    })
    expect(stalePollCompletion.count).toBe(0)
    expect(state.partnerVersion).toBe(400)
    expect(state.nextReconcileAt).toBeNull()
  })
})

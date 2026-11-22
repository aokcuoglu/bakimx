import { createHmac, timingSafeEqual } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { isUniqueConstraintError } from "@/lib/prisma-errors"
import { procurementOrderSchema } from "./getirbakim-client"
import { applyExternalProcurementProjection, procurementOrderRevision } from "./service"

/**
 * GetirBakım partner webhooks — partner order contract v2.3 (getirbakim#1002,
 * getirbakim docs/partner-order-contract.md "Webhooks"; envelope specVersion
 * "1.0", Order object contractVersion "2.0").
 *
 * GetirBakım POSTs a signed, state-carrying event when one of our orders (or a
 * return request) changes; delivery is at least once, unordered, retried with
 * backoff for 72 hours and may be re-sent later with the same eventId. Every
 * event lands in the ExternalProcurementEvent inbox (unique on provider +
 * eventId, so a repeat is a no-op) and an order event is applied through the
 * same monotonic projector as polling (applyExternalProcurementProjection), so
 * push and pull cannot diverge and an older state never overwrites a newer one.
 * Polling (/api/cron/external-procurements, "Durumu güncelle") stays the
 * fallback for anything a webhook misses.
 */
export const GETIRBAKIM_WEBHOOK_SPEC_VERSION = "1.0"
export const GETIRBAKIM_ORDER_EVENT_TYPE = "partner.order.updated"
export const GETIRBAKIM_RETURN_EVENT_TYPE = "partner.return.updated"
export const GETIRBAKIM_WEBHOOK_HEADERS = {
  eventId: "x-getirbakim-event-id",
  eventType: "x-getirbakim-event-type",
  timestamp: "x-getirbakim-timestamp",
  signature: "x-getirbakim-signature",
} as const
export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300
export const MAX_WEBHOOK_BODY_BYTES = 64 * 1024
/** Inbox status of an authenticated event BakımX has no handler for (returns, future types). */
export const UNSUPPORTED_EVENT_STATUS = "ignored_unsupported"

export class WebhookBodyTooLargeError extends Error {}

export async function readBoundedWebhookBody(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes = MAX_WEBHOOK_BODY_BYTES,
): Promise<string> {
  if (!stream) return ""
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel("webhook body too large").catch(() => undefined)
        throw new WebhookBodyTooLargeError("Webhook payload too large")
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(body)
}

const envelopeShape = {
  specVersion: z.literal(GETIRBAKIM_WEBHOOK_SPEC_VERSION),
  eventId: z.string().min(1).max(128),
  eventType: z.string().min(1).max(128),
  occurredAt: z.string().datetime(),
  partnerId: z.string().min(1).max(128),
}

/** Envelope fields every event carries; the payload key depends on eventType. */
const webhookEnvelopeSchema = z.object(envelopeShape).passthrough()

/** partner.order.updated: strict, the Order object is the same one polling reads. */
export const procurementWebhookSchema = z.object({
  ...envelopeShape,
  eventType: z.literal(GETIRBAKIM_ORDER_EVENT_TYPE),
  order: procurementOrderSchema,
}).strict()

/**
 * partner.return.updated: BakımX has no return flow, so only the identifiers
 * are read (for the inbox row); the rest of the Return object is not stored.
 */
const returnWebhookSchema = z.object({
  ...envelopeShape,
  eventType: z.literal(GETIRBAKIM_RETURN_EVENT_TYPE),
  return: z.object({ id: z.string().min(1).max(128), orderId: z.string().min(1).max(128) }).passthrough(),
}).strict()

export type ProcurementWebhookEvent = z.infer<typeof procurementWebhookSchema>

export type ParsedGetirbakimWebhook =
  | { kind: "order"; event: ProcurementWebhookEvent }
  | { kind: "unsupported"; eventId: string; eventType: string; specVersion: string; partnerId: string; externalOrderId: string }

/**
 * Routes on the body's eventType (the contract: route and dedupe on the body,
 * the X-GetirBakim-Event-* headers are unsigned copies). Unknown types are
 * accepted as unsupported, as the contract asks. null = an authenticated body
 * that does not match the contract (missing envelope field, other specVersion,
 * an Order that fails the strict schema).
 */
export function parseGetirbakimWebhook(body: unknown): ParsedGetirbakimWebhook | null {
  const envelope = webhookEnvelopeSchema.safeParse(body)
  if (!envelope.success) return null
  const { eventId, eventType, specVersion, partnerId } = envelope.data
  if (eventType === GETIRBAKIM_ORDER_EVENT_TYPE) {
    const order = procurementWebhookSchema.safeParse(body)
    return order.success ? { kind: "order", event: order.data } : null
  }
  if (eventType === GETIRBAKIM_RETURN_EVENT_TYPE) {
    const request = returnWebhookSchema.safeParse(body)
    if (!request.success) return null
    return { kind: "unsupported", eventId, eventType, specVersion, partnerId, externalOrderId: request.data.return.orderId }
  }
  return { kind: "unsupported", eventId, eventType, specVersion, partnerId, externalOrderId: "" }
}

export function validateProcurementWebhookEnvelope(
  event: { eventId: string; eventType: string; partnerId: string },
  expected: { eventId: string; eventType: string; partnerId: string },
): "event_id_mismatch" | "event_type_mismatch" | "partner_mismatch" | null {
  if (event.eventId !== expected.eventId) return "event_id_mismatch"
  if (event.eventType !== expected.eventType) return "event_type_mismatch"
  if (event.partnerId !== expected.partnerId) return "partner_mismatch"
  return null
}

/** The contract's only scheme: `v1=` + 64 hex characters. */
function signatureBytes(value: string): Buffer | null {
  if (!/^v1=[0-9a-f]{64}$/i.test(value)) return null
  return Buffer.from(value.slice(3), "hex")
}

/**
 * `X-GetirBakim-Signature` = `v1=` + hex HMAC-SHA256 of `${timestamp}.${rawBody}`
 * with the shared secret; `X-GetirBakim-Timestamp` is unix seconds of this
 * attempt (re-signed per retry), so the replay window applies to every attempt.
 */
export function verifyProcurementWebhook(input: {
  rawBody: string
  timestamp: string
  signature: string
  secret: string
  nowMs?: number
  toleranceSeconds?: number
}): { ok: true } | { ok: false; code: "invalid_timestamp" | "stale_timestamp" | "invalid_signature" } {
  if (!/^\d+$/.test(input.timestamp)) return { ok: false, code: "invalid_timestamp" }
  const timestampSeconds = Number(input.timestamp)
  if (!Number.isSafeInteger(timestampSeconds)) return { ok: false, code: "invalid_timestamp" }
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000)
  const tolerance = input.toleranceSeconds ?? DEFAULT_WEBHOOK_TOLERANCE_SECONDS
  if (Math.abs(nowSeconds - timestampSeconds) > tolerance) return { ok: false, code: "stale_timestamp" }

  const supplied = signatureBytes(input.signature)
  if (!supplied) return { ok: false, code: "invalid_signature" }
  const expected = createHmac("sha256", input.secret)
    .update(`${input.timestamp}.${input.rawBody}`, "utf8")
    .digest()
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
    ? { ok: true }
    : { ok: false, code: "invalid_signature" }
}

type WebhookDatabase = {
  $transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>
}

export async function processProcurementWebhook(input: {
  provider: string
  eventId: string
  contractVersion: string
  event: ProcurementWebhookEvent
}, database: WebhookDatabase = prisma) {
  try {
    return await database.$transaction(async (tx) => {
      const inbox = await tx.externalProcurementEvent.create({
        data: {
          provider: input.provider, eventId: input.eventId, contractVersion: input.contractVersion,
          eventType: input.event.eventType, externalOrderId: input.event.order.id,
          partnerVersion: procurementOrderRevision(input.event.order),
        },
      })
      const local = await tx.externalProcurementOrder.findFirst({
        where: { provider: input.provider, externalOrderId: input.event.order.id }, select: { id: true },
      })
      if (!local) {
        await tx.externalProcurementEvent.update({
          where: { id: inbox.id },
          data: { status: "failed", failureCode: "ORDER_NOT_FOUND", processedAt: new Date() },
        })
        return { status: "failed" as const, applied: false, failureCode: "ORDER_NOT_FOUND" }
      }
      const applied = await applyExternalProcurementProjection(tx, local.id, input.event.order)
      await tx.externalProcurementEvent.update({
        where: { id: inbox.id },
        data: { status: applied ? "processed" : "ignored_stale", processedAt: new Date() },
      })
      return { status: applied ? "processed" as const : "ignored_stale" as const, applied }
    })
  } catch (error) {
    if (isUniqueConstraintError(error, "eventId")) {
      return { status: "duplicate" as const, applied: false }
    }
    throw error
  }
}

type InboxDatabase = {
  externalProcurementEvent: Pick<Prisma.TransactionClient["externalProcurementEvent"], "create">
}

/**
 * Records an authenticated event BakımX does not act on (a return decision, a
 * future event type) so it is acknowledged once and audited; a repeat with the
 * same eventId is a duplicate.
 */
export async function recordUnsupportedProcurementWebhook(input: {
  provider: string
  eventId: string
  contractVersion: string
  eventType: string
  externalOrderId: string
}, database: InboxDatabase = prisma) {
  try {
    await database.externalProcurementEvent.create({
      data: {
        provider: input.provider, eventId: input.eventId, contractVersion: input.contractVersion,
        eventType: input.eventType, externalOrderId: input.externalOrderId, partnerVersion: 0,
        status: UNSUPPORTED_EVENT_STATUS, processedAt: new Date(),
      },
    })
    return { status: UNSUPPORTED_EVENT_STATUS, applied: false }
  } catch (error) {
    if (isUniqueConstraintError(error, "eventId")) return { status: "duplicate" as const, applied: false }
    throw error
  }
}

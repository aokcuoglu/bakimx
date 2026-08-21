import { createHmac, timingSafeEqual } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { isUniqueConstraintError } from "@/lib/prisma-errors"
import { procurementOrderSchema } from "./getirbakim-client"
import { applyExternalProcurementProjection } from "./service"

export const PROCUREMENT_WEBHOOK_VERSION = "1.0"
export const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300
export const MAX_WEBHOOK_BODY_BYTES = 64 * 1024

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

export const procurementWebhookSchema = z.object({
  specVersion: z.literal(PROCUREMENT_WEBHOOK_VERSION),
  eventId: z.string().min(1).max(128),
  eventType: z.literal("partner.order.updated"),
  occurredAt: z.string().datetime(),
  partnerId: z.string().min(1).max(128),
  order: procurementOrderSchema,
}).strict()

export function validateProcurementWebhookEnvelope(
  event: z.infer<typeof procurementWebhookSchema>,
  expected: { eventId: string; version: string; partnerId: string },
): "event_id_mismatch" | "version_mismatch" | "partner_mismatch" | null {
  if (event.eventId !== expected.eventId) return "event_id_mismatch"
  if (event.specVersion !== expected.version) return "version_mismatch"
  if (event.partnerId !== expected.partnerId) return "partner_mismatch"
  return null
}

function signatureBytes(value: string): Buffer | null {
  const hex = value.startsWith("v1=") ? value.slice(3) : value
  if (!/^[0-9a-f]{64}$/i.test(hex)) return null
  return Buffer.from(hex, "hex")
}

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
  return timingSafeEqual(supplied, expected) ? { ok: true } : { ok: false, code: "invalid_signature" }
}

type WebhookDatabase = {
  $transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>
}

export async function processProcurementWebhook(input: {
  provider: string
  eventId: string
  contractVersion: string
  event: z.infer<typeof procurementWebhookSchema>
}, database: WebhookDatabase = prisma) {
  try {
    return await database.$transaction(async (tx) => {
      const inbox = await tx.externalProcurementEvent.create({
        data: {
          provider: input.provider, eventId: input.eventId, contractVersion: input.contractVersion,
          eventType: input.event.eventType, externalOrderId: input.event.order.id,
          partnerVersion: input.event.order.version,
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

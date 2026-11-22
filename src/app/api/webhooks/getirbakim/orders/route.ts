import { NextResponse } from "next/server"
import {
  DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
  GETIRBAKIM_WEBHOOK_HEADERS,
  MAX_WEBHOOK_BODY_BYTES,
  parseGetirbakimWebhook,
  processProcurementWebhook,
  readBoundedWebhookBody,
  recordUnsupportedProcurementWebhook,
  validateProcurementWebhookEnvelope,
  verifyProcurementWebhook,
  WebhookBodyTooLargeError,
} from "@/lib/external-procurement/webhook"

/*
 * GetirBakım partner webhooks (contract v2.3, see lib/external-procurement/webhook.ts).
 * Answers: 2xx only once the event is in the inbox (GetirBakım then stops
 * retrying); 400/401/413 for a request that is not a valid signed delivery;
 * 422 for a signed body that does not match the contract (GetirBakım retries
 * for 72 hours, then keeps it as dead and can requeue it after a fix); 503
 * while the secret is not configured. Unknown and return events are recorded
 * and acknowledged. A database error is a 500 and the retry is safe (the
 * transaction rolled back, the eventId is not consumed).
 */

function toleranceSeconds(): number {
  const configured = Number(process.env.GETIRBAKIM_WEBHOOK_TOLERANCE_SECONDS)
  return Number.isInteger(configured) && configured >= 30 && configured <= 900
    ? configured
    : DEFAULT_WEBHOOK_TOLERANCE_SECONDS
}

export async function POST(request: Request) {
  const secret = process.env.GETIRBAKIM_WEBHOOK_SECRET?.trim()
  if (!secret || secret.length < 32) return NextResponse.json({ error: "Webhook configuration unavailable." }, { status: 503 })

  const header = (name: string) => request.headers.get(name)?.trim() ?? ""
  const eventId = header(GETIRBAKIM_WEBHOOK_HEADERS.eventId)
  const eventType = header(GETIRBAKIM_WEBHOOK_HEADERS.eventType)
  const timestamp = header(GETIRBAKIM_WEBHOOK_HEADERS.timestamp)
  const signature = header(GETIRBAKIM_WEBHOOK_HEADERS.signature)
  if (!eventId || eventId.length > 128 || !eventType || eventType.length > 128 || !timestamp || !signature) {
    return NextResponse.json({ error: "Invalid webhook headers." }, { status: 400 })
  }

  const contentLength = request.headers.get("content-length")
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_WEBHOOK_BODY_BYTES) {
    return NextResponse.json({ error: "Webhook payload too large." }, { status: 413 })
  }
  let rawBody: string
  try { rawBody = await readBoundedWebhookBody(request.body) } catch (error) {
    if (error instanceof WebhookBodyTooLargeError) {
      return NextResponse.json({ error: "Webhook payload too large." }, { status: 413 })
    }
    return NextResponse.json({ error: "Invalid webhook payload encoding." }, { status: 400 })
  }
  const verification = verifyProcurementWebhook({
    rawBody, timestamp, signature, secret, toleranceSeconds: toleranceSeconds(),
  })
  if (!verification.ok) {
    return NextResponse.json({ error: "Invalid webhook signature.", code: verification.code }, { status: 401 })
  }

  let body: unknown
  try { body = JSON.parse(rawBody) } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 })
  }
  const parsed = parseGetirbakimWebhook(body)
  if (!parsed) return NextResponse.json({ error: "Webhook payload does not match the contract." }, { status: 422 })

  const envelope = parsed.kind === "order" ? parsed.event : parsed
  const expectedPartnerId = process.env.GETIRBAKIM_WEBHOOK_PARTNER_ID?.trim() || "bakimx"
  const envelopeError = validateProcurementWebhookEnvelope(envelope, { eventId, eventType, partnerId: expectedPartnerId })
  if (envelopeError) {
    return NextResponse.json(
      { error: "Webhook envelope does not match its headers or receiver.", code: envelopeError },
      { status: envelopeError === "partner_mismatch" ? 422 : 400 },
    )
  }

  if (parsed.kind === "unsupported") {
    const result = await recordUnsupportedProcurementWebhook({
      provider: "getirbakim", eventId: parsed.eventId, contractVersion: parsed.specVersion,
      eventType: parsed.eventType, externalOrderId: parsed.externalOrderId,
    })
    return NextResponse.json({ accepted: true, ...result }, { status: 200 })
  }
  const result = await processProcurementWebhook({
    provider: "getirbakim", eventId: parsed.event.eventId, contractVersion: parsed.event.specVersion, event: parsed.event,
  })
  return NextResponse.json({ accepted: true, ...result }, { status: result.status === "failed" ? 202 : 200 })
}

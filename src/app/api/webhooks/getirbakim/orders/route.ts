import { NextResponse } from "next/server"
import {
  DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
  MAX_WEBHOOK_BODY_BYTES,
  PROCUREMENT_WEBHOOK_VERSION,
  processProcurementWebhook,
  procurementWebhookSchema,
  readBoundedWebhookBody,
  validateProcurementWebhookEnvelope,
  verifyProcurementWebhook,
  WebhookBodyTooLargeError,
} from "@/lib/external-procurement/webhook"

function toleranceSeconds(): number {
  const configured = Number(process.env.GETIRBAKIM_WEBHOOK_TOLERANCE_SECONDS)
  return Number.isInteger(configured) && configured >= 30 && configured <= 900
    ? configured
    : DEFAULT_WEBHOOK_TOLERANCE_SECONDS
}

export async function POST(request: Request) {
  const secret = process.env.GETIRBAKIM_WEBHOOK_SECRET?.trim()
  if (!secret || secret.length < 32) return NextResponse.json({ error: "Webhook configuration unavailable." }, { status: 503 })

  const eventId = request.headers.get("webhook-id")?.trim() ?? ""
  const timestamp = request.headers.get("webhook-timestamp")?.trim() ?? ""
  const signature = request.headers.get("webhook-signature")?.trim() ?? ""
  const version = request.headers.get("webhook-version")?.trim() ?? ""
  if (!eventId || eventId.length > 128 || !timestamp || !signature || version !== PROCUREMENT_WEBHOOK_VERSION) {
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
  const parsed = procurementWebhookSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 })
  const expectedPartnerId = process.env.GETIRBAKIM_WEBHOOK_PARTNER_ID?.trim() || "bakimx"
  const envelopeError = validateProcurementWebhookEnvelope(parsed.data, {
    eventId, version, partnerId: expectedPartnerId,
  })
  if (envelopeError) {
    return NextResponse.json({ error: "Webhook envelope does not match its headers or receiver.", code: envelopeError }, { status: 400 })
  }

  const result = await processProcurementWebhook({
    provider: "getirbakim", eventId, contractVersion: version, event: parsed.data,
  })
  return NextResponse.json({ accepted: true, ...result }, { status: result.status === "failed" ? 202 : 200 })
}

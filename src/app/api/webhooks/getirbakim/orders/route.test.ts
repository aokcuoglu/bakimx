import { createHmac } from "node:crypto"
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { contractOrder } from "@/lib/external-procurement/contract-v2.fixtures"
import { MAX_WEBHOOK_BODY_BYTES } from "@/lib/external-procurement/webhook"
import { POST } from "./route"

const previousSecret = process.env.GETIRBAKIM_WEBHOOK_SECRET
const previousPartner = process.env.GETIRBAKIM_WEBHOOK_PARTNER_ID
const secret = "test-webhook-secret-0123456789abcdef"
const url = "https://bakimx.test/api/webhooks/getirbakim/orders"

beforeEach(() => {
  process.env.GETIRBAKIM_WEBHOOK_SECRET = secret
  delete process.env.GETIRBAKIM_WEBHOOK_PARTNER_ID
})

afterEach(() => {
  if (previousSecret === undefined) delete process.env.GETIRBAKIM_WEBHOOK_SECRET
  else process.env.GETIRBAKIM_WEBHOOK_SECRET = previousSecret
  if (previousPartner === undefined) delete process.env.GETIRBAKIM_WEBHOOK_PARTNER_ID
  else process.env.GETIRBAKIM_WEBHOOK_PARTNER_ID = previousPartner
})

/** The body as getirbakim buildPartnerOrderEvent serializes it (same key order). */
function orderEventBody(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    specVersion: "1.0", eventId: "evt-1", eventType: "partner.order.updated",
    occurredAt: "2026-11-21T09:30:00.000Z", partnerId: "bakimx", order: { ...contractOrder, status: "SHIPPED" },
    ...overrides,
  })
}

/** getirbakim signPartnerWebhook + webhookHeaders. */
function signedHeaders(body: string, { timestamp = String(Math.floor(Date.now() / 1000)), eventId = "evt-1", eventType = "partner.order.updated", key = secret } = {}) {
  return {
    "Content-Type": "application/json",
    "User-Agent": "GetirBakim-Webhooks/1",
    "X-GetirBakim-Event-Id": eventId,
    "X-GetirBakim-Event-Type": eventType,
    "X-GetirBakim-Timestamp": timestamp,
    "X-GetirBakim-Signature": `v1=${createHmac("sha256", key).update(`${timestamp}.${body}`, "utf8").digest("hex")}`,
  }
}

function post(body: string | ReadableStream<Uint8Array>, headers: Record<string, string>) {
  return POST(new Request(url, { method: "POST", body, headers, duplex: "half" } as RequestInit & { duplex: "half" }))
}

describe("GetirBakim order webhook boundary", () => {
  test("fails closed when the dedicated secret is missing or shorter than 32 characters", async () => {
    const body = orderEventBody()
    process.env.GETIRBAKIM_WEBHOOK_SECRET = "too-short"
    expect((await post(body, signedHeaders(body))).status).toBe(503)
    delete process.env.GETIRBAKIM_WEBHOOK_SECRET
    expect((await post(body, signedHeaders(body))).status).toBe(503)
  })

  test("rejects the retired webhook-* header set and missing contract headers", async () => {
    const body = orderEventBody()
    const timestamp = String(Math.floor(Date.now() / 1000))
    const legacy = {
      "webhook-id": "evt-1", "webhook-timestamp": timestamp, "webhook-version": "1.0",
      "webhook-signature": `v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`,
    }
    expect((await post(body, legacy)).status).toBe(400)
    for (const name of ["X-GetirBakim-Event-Id", "X-GetirBakim-Event-Type", "X-GetirBakim-Timestamp", "X-GetirBakim-Signature"]) {
      const headers: Record<string, string> = signedHeaders(body)
      delete headers[name]
      expect((await post(body, headers)).status).toBe(400)
    }
  })

  test("rejects a wrong secret, a tampered body and a malformed signature with 401", async () => {
    const body = orderEventBody()
    const wrongKey = await post(body, signedHeaders(body, { key: "another-webhook-secret-0123456789abcdef" }))
    expect(wrongKey.status).toBe(401)
    expect(await wrongKey.json()).toMatchObject({ code: "invalid_signature" })
    expect((await post(`${body} `, signedHeaders(body))).status).toBe(401)
    expect((await post(body, { ...signedHeaders(body), "X-GetirBakim-Signature": "v1=nope" })).status).toBe(401)
  })

  test("rejects a timestamp outside GETIRBAKIM_WEBHOOK_TOLERANCE_SECONDS (default 300)", async () => {
    const body = orderEventBody()
    const old = String(Math.floor(Date.now() / 1000) - 301)
    const response = await post(body, signedHeaders(body, { timestamp: old }))
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: "stale_timestamp" })
    const millis = String(Date.now())
    expect(await (await post(body, signedHeaders(body, { timestamp: millis }))).json()).toMatchObject({ code: "stale_timestamp" })
  })

  test("a correctly signed body is checked against its headers and the receiver's partner id", async () => {
    // These answers come after the signature check passed and before any database work.
    const body = orderEventBody()
    const otherId = await post(body, signedHeaders(body, { eventId: "evt-2" }))
    expect(otherId.status).toBe(400)
    expect(await otherId.json()).toMatchObject({ code: "event_id_mismatch" })
    expect(await (await post(body, signedHeaders(body, { eventType: "partner.return.updated" }))).json()).toMatchObject({ code: "event_type_mismatch" })

    const foreign = orderEventBody({ partnerId: "other-partner" })
    const mismatch = await post(foreign, signedHeaders(foreign))
    expect(mismatch.status).toBe(422)
    expect(await mismatch.json()).toMatchObject({ code: "partner_mismatch" })
    process.env.GETIRBAKIM_WEBHOOK_PARTNER_ID = "other-partner"
    expect((await post(body, signedHeaders(body))).status).toBe(422)
  })

  test("a signed body outside the contract is 422, not JSON is 400", async () => {
    const future = orderEventBody({ specVersion: "2.0" })
    expect((await post(future, signedHeaders(future))).status).toBe(422)
    const broken = orderEventBody({ order: { ...contractOrder, supplierCostKurus: 1 } })
    expect((await post(broken, signedHeaders(broken))).status).toBe(422)
    expect((await post("not json", signedHeaders("not json"))).status).toBe(400)
  })

  test("rejects an oversized declared body before reading it", async () => {
    const headers = { ...signedHeaders("{}"), "content-length": String(MAX_WEBHOOK_BODY_BYTES + 1) }
    expect((await post("{}", headers)).status).toBe(413)
  })

  test("rejects an oversized chunked body after reading it", async () => {
    let cancelled = false
    const chunk = new Uint8Array(32 * 1024).fill(65)
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk)
        controller.enqueue(chunk)
        controller.enqueue(new Uint8Array([66]))
      },
      cancel() { cancelled = true },
    })
    const response = await post(body, signedHeaders("{}"))
    expect(response.status).toBe(413)
    expect(cancelled).toBe(true)
  })
})

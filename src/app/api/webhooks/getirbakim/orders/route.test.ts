import { afterEach, describe, expect, test } from "bun:test"
import { MAX_WEBHOOK_BODY_BYTES } from "@/lib/external-procurement/webhook"
import { POST } from "./route"

const previousSecret = process.env.GETIRBAKIM_WEBHOOK_SECRET

afterEach(() => {
  if (previousSecret === undefined) delete process.env.GETIRBAKIM_WEBHOOK_SECRET
  else process.env.GETIRBAKIM_WEBHOOK_SECRET = previousSecret
})

describe("GetirBakim order webhook boundary", () => {
  test("fails closed when the dedicated secret is shorter than 32 characters", async () => {
    process.env.GETIRBAKIM_WEBHOOK_SECRET = "too-short"
    const response = await POST(new Request("https://bakimx.test/api/webhooks/getirbakim/orders", { method: "POST", body: "{}" }))
    expect(response.status).toBe(503)
  })

  test("rejects an oversized declared body before reading it", async () => {
    process.env.GETIRBAKIM_WEBHOOK_SECRET = "x".repeat(32)
    const response = await POST(new Request("https://bakimx.test/api/webhooks/getirbakim/orders", {
      method: "POST", body: "{}", headers: {
        "content-length": String(MAX_WEBHOOK_BODY_BYTES + 1),
        "webhook-id": "evt-1", "webhook-timestamp": "1787342400",
        "webhook-signature": "v1=" + "0".repeat(64), "webhook-version": "1.0",
      },
    }))
    expect(response.status).toBe(413)
  })

  test("rejects an oversized chunked body after reading it", async () => {
    process.env.GETIRBAKIM_WEBHOOK_SECRET = "x".repeat(32)
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
    const response = await POST(new Request("https://bakimx.test/api/webhooks/getirbakim/orders", {
      method: "POST", body, duplex: "half", headers: {
        "webhook-id": "evt-1", "webhook-timestamp": "1787342400",
        "webhook-signature": "v1=" + "0".repeat(64), "webhook-version": "1.0",
      },
    } as RequestInit & { duplex: "half" }))
    expect(response.status).toBe(413)
    expect(cancelled).toBe(true)
  })
})

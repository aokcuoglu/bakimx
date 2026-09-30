import { describe, expect, test } from "bun:test"
import { GetirBakimClient } from "./getirbakim-client"
import { ProcurementProviderError } from "./types"

const order = {
  contractVersion: "1.0", id: "remote-1", status: "REQUESTED", version: 1,
  bindingPrice: { netKurus: 1000, vatKurus: 200, grossKurus: 1200, currency: "TRY", policyVersion: "opaque-v1", expiresAt: "2026-08-21T21:00:00.000Z" },
  items: [{ sourceProductId: "1", selectedOfferId: "offer_1", quantity: 1, unitNetKurus: 1000, unitVatKurus: 200, unitGrossKurus: 1200 }],
  cancellationRequested: false, createdAt: "2026-08-21T20:00:00.000Z", updatedAt: "2026-08-21T20:00:00.000Z",
}

describe("GetirBakimClient", () => {
  test("sends partner identity only in auth and idempotency only in its header", async () => {
    let request: Request | undefined
    const client = new GetirBakimClient("https://partner.test", "secret", async (input, init) => {
      request = new Request(input, init)
      return Response.json({ order, replayed: false }, { status: 201 })
    })
    await client.createOrder({ idempotencyKey: "key", selectedOfferId: "offer_1", quantity: 1, expectedUnitNetKurus: 1000, confirmationToken: "opaque-confirmation-token" })
    expect(request!.headers.get("authorization")).toBe("Bearer secret")
    expect(request!.headers.get("idempotency-key")).toBe("key")
    expect(await request!.json()).toEqual({ selectedOfferId: "offer_1", quantity: 1, expectedUnitNetKurus: 1000, confirmationToken: "opaque-confirmation-token" })
  })

  test("accepts the PR #86 quote shape and preserves its opaque confirmation token", async () => {
    const client = new GetirBakimClient("https://partner.test", "secret", async () => Response.json({ quote: {
      selectedOfferId: "offer_1", quantity: 1, bindingNetKurus: 1000, bindingVatKurus: 200,
      bindingGrossKurus: 1200, unitNetKurus: 1000, currency: "TRY", policyVersion: "opaque-v1",
      expiresAt: "2026-08-21T21:00:00.000Z", confirmationToken: "opaque-confirmation-token",
    } }))
    await expect(client.quoteOrder("offer_1", 1)).resolves.toMatchObject({ confirmationToken: "opaque-confirmation-token" })
  })

  test("fails closed on confidential or malformed provider responses", async () => {
    const client = new GetirBakimClient("https://partner.test", "secret", async () => Response.json({ order: { ...order, supplierCost: 1 } }))
    await expect(client.getOrder("remote-1")).rejects.toBeInstanceOf(ProcurementProviderError)
  })

  test("reads direct order responses and top-level error details", async () => {
    const read = new GetirBakimClient("https://partner.test", "order-secret", async () => Response.json({ order }))
    await expect(read.getOrder("remote-1")).resolves.toEqual(order)
    await expect(read.cancelOrder("remote-1")).resolves.toEqual(order)
    const rejected = new GetirBakimClient("https://partner.test", "order-secret", async () => Response.json({
      error: { code: "PRICE_CHANGED", message: "Confirm new price" },
      details: { bindingNetKurus: 1200, currency: "TRY" }, requestId: "req-1",
    }, { status: 409 }))
    const error = await rejected.createOrder({ idempotencyKey: "key", selectedOfferId: "offer_1", quantity: 1, expectedUnitNetKurus: 1000, confirmationToken: "token" }).catch((caught) => caught)
    expect(error).toMatchObject({ code: "PRICE_CHANGED", status: 409, details: { bindingNetKurus: 1200, currency: "TRY" } })
  })

  test("reconciles a timed-out create by the same key and treats only ORDER_NOT_FOUND as absent", async () => {
    let requestedPath = ""
    const found = new GetirBakimClient("https://partner.test", "order-secret", async (input) => {
      requestedPath = new URL(input).pathname
      return Response.json({ order })
    })
    await expect(found.getOrderByIdempotencyKey("attempt/1")).resolves.toEqual(order)
    expect(requestedPath).toBe("/api/partner/v1/orders/by-key/attempt%2F1")

    const missing = new GetirBakimClient("https://partner.test", "order-secret", async () => Response.json({
      error: { code: "ORDER_NOT_FOUND", message: "Order not found" }, requestId: "req-2",
    }, { status: 404 }))
    await expect(missing.getOrderByIdempotencyKey("attempt-2")).resolves.toBeNull()
  })

  test.each([
    new Response("<html>gateway failure</html>", { status: 502, headers: { "content-type": "text/html" } }),
    new Response("not-json", { status: 200, headers: { "content-type": "application/json" } }),
  ])("fails closed with a controlled provider error for a non-JSON response", async (response) => {
    const client = new GetirBakimClient("https://partner.test", "secret", async () => response.clone())
    const error = await client.quoteOrder("offer_1", 1).catch((caught) => caught)
    expect(error).toBeInstanceOf(ProcurementProviderError)
    expect(error).not.toBeInstanceOf(SyntaxError)
  })
})

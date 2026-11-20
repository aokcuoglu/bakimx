import { describe, expect, test } from "bun:test"
import { GetirBakimClient } from "./getirbakim-client"
import { contractOrder, contractQuote, contractShippingAddress, OFFER_ID } from "./contract-v2.fixtures"
import { ProcurementProviderError } from "./types"

const createInput = {
  idempotencyKey: "0f8fad5b-d9cb-469f-a165-70867728950e",
  confirmationToken: "opaque-confirmation-token",
  lines: [{ selectedOfferId: OFFER_ID, quantity: 2, expectedUnitNetKurus: 13000 }],
  shippingAddress: contractShippingAddress,
}

function capture(response: () => Response) {
  const requests: Request[] = []
  const client = new GetirBakimClient("https://partner.test", "secret", async (input, init) => {
    requests.push(new Request(input, init))
    return response()
  })
  return { client, requests }
}

describe("GetirBakimClient (contract v2.0)", () => {
  test("quotes multi-line bodies and returns the binding v2.0 quote", async () => {
    const { client, requests } = capture(() => Response.json({ quote: contractQuote }))
    await expect(client.quoteOrder([{ selectedOfferId: OFFER_ID, quantity: 2 }])).resolves.toEqual(contractQuote)
    expect(new URL(requests[0].url).pathname).toBe("/api/partner/v1/order-quotes")
    expect(requests[0].method).toBe("POST")
    expect(await requests[0].json()).toEqual({ lines: [{ selectedOfferId: OFFER_ID, quantity: 2 }] })
  })

  test("refuses line sets the contract would refuse, before any request", async () => {
    const { client, requests } = capture(() => Response.json({ quote: contractQuote }))
    for (const lines of [
      [],
      [{ selectedOfferId: OFFER_ID, quantity: 100 }],
      [{ selectedOfferId: OFFER_ID, quantity: 1 }, { selectedOfferId: OFFER_ID, quantity: 2 }],
      Array.from({ length: 21 }, (_, index) => ({ selectedOfferId: `offer_${index}`, quantity: 1 })),
    ]) {
      await expect(client.quoteOrder(lines)).rejects.toMatchObject({ code: "VALIDATION_ERROR", retryable: false })
    }
    expect(requests).toHaveLength(0)
  })

  test("rejects a 1.0 quote shape", async () => {
    const { client } = capture(() => Response.json({ quote: {
      selectedOfferId: OFFER_ID, quantity: 1, bindingNetKurus: 1000, bindingVatKurus: 200, bindingGrossKurus: 1200,
      unitNetKurus: 1000, currency: "TRY", policyVersion: "v1", expiresAt: "2026-08-21T21:00:00.000Z", confirmationToken: "t",
    } }))
    await expect(client.quoteOrder([{ selectedOfferId: OFFER_ID, quantity: 1 }])).rejects.toMatchObject({ code: "INVALID_PROVIDER_RESPONSE" })
  })

  test("sends the contract's order body with the address and only the idempotency header", async () => {
    const { client, requests } = capture(() => Response.json({ order: contractOrder, replayed: false }, { status: 201 }))
    const result = await client.createOrder({ ...createInput, note: "  İş emri 42  " })
    expect(result).toMatchObject({ replayed: false, order: { id: contractOrder.id, status: "REQUESTED", totals: { shippingKurus: 5000 } } })
    const request = requests[0]
    expect(new URL(request.url).pathname).toBe("/api/partner/v1/orders")
    expect(request.headers.get("authorization")).toBe("Bearer secret")
    expect(request.headers.get("idempotency-key")).toBe(createInput.idempotencyKey)
    expect(await request.json()).toEqual({
      confirmationToken: "opaque-confirmation-token",
      lines: [{ selectedOfferId: OFFER_ID, quantity: 2, expectedUnitNetKurus: 13000 }],
      shippingAddress: contractShippingAddress,
      note: "İş emri 42",
    })
  })

  test("omits empty optional fields from the strict order body", async () => {
    const { client, requests } = capture(() => Response.json({ order: contractOrder, replayed: true }))
    const { email: _email, postalCode: _postalCode, ...required } = contractShippingAddress
    await client.createOrder({ ...createInput, shippingAddress: { ...required, email: null, postalCode: null }, note: "  " })
    const body = await requests[0].json() as Record<string, unknown>
    expect(body).not.toHaveProperty("note")
    expect(body.shippingAddress).toEqual(required)
  })

  test("reads orders, shipments and cancellation requests", async () => {
    const shipped = {
      ...contractOrder, status: "SHIPPED",
      shipment: { carrier: "Yurtiçi Kargo", trackingNo: "123", trackingUrl: "https://kargo.test/123", shippedAt: "2026-11-19T08:00:00.000Z", deliveredAt: null },
      cancellationRequest: { status: "REJECTED", requestedAt: "2026-11-18T12:00:00.000Z", decidedAt: "2026-11-18T13:00:00.000Z" },
    }
    const { client } = capture(() => Response.json({ order: shipped }))
    await expect(client.getOrder(contractOrder.id)).resolves.toMatchObject({ status: "SHIPPED", shipment: { trackingNo: "123" }, cancellationRequest: { status: "REJECTED" } })
  })

  test("tolerates the nullable address columns GetirBakım stores", async () => {
    const { client } = capture(() => Response.json({ order: { ...contractOrder, shippingAddress: { ...contractOrder.shippingAddress, province: null, district: null, addressLine: null } } }))
    await expect(client.getOrder(contractOrder.id)).resolves.toMatchObject({ shippingAddress: { province: "", district: "", addressLine: "" } })
  })

  test("maps DELETE answers to cancelled at once or requested", async () => {
    const cancelled = { ...contractOrder, status: "CANCELLED", cancelledBy: "PARTNER", cancelledAt: "2026-11-18T10:05:00.000Z" }
    const immediate = capture(() => Response.json({ order: cancelled, cancellation: "CANCELLED" }))
    await expect(immediate.client.cancelOrder(contractOrder.id)).resolves.toMatchObject({ cancellation: "CANCELLED", order: { status: "CANCELLED" } })
    expect(immediate.requests[0].method).toBe("DELETE")

    const pending = { ...contractOrder, status: "CONFIRMED", cancellationRequest: { status: "PENDING", requestedAt: "2026-11-18T11:00:00.000Z", decidedAt: null } }
    const requested = capture(() => Response.json({ order: pending, cancellation: "REQUESTED" }, { status: 202 }))
    await expect(requested.client.cancelOrder(contractOrder.id)).resolves.toMatchObject({ cancellation: "REQUESTED", order: { cancellationRequest: { status: "PENDING" } } })
  })

  test("fails closed on confidential fields or 1.0-only statuses", async () => {
    for (const order of [{ ...contractOrder, supplierCost: 1 }, { ...contractOrder, status: "RESERVATION_EXPIRED" }, { ...contractOrder, contractVersion: "1.0" }]) {
      const { client } = capture(() => Response.json({ order }))
      await expect(client.getOrder(contractOrder.id)).rejects.toBeInstanceOf(ProcurementProviderError)
    }
  })

  test("reads the contract's nested error details", async () => {
    const { client } = capture(() => Response.json({ error: {
      code: "CREDIT_LIMIT_EXCEEDED", message: "Limit exceeded",
      details: { limitKurus: 100000, openKurus: 90000, orderKurus: 36200 },
    } }, { status: 409 }))
    const error = await client.createOrder(createInput).catch((caught) => caught)
    expect(error).toMatchObject({ code: "CREDIT_LIMIT_EXCEEDED", status: 409, retryable: false, details: { limitKurus: 100000 } })
  })

  test("treats 429 and 5xx as retryable", async () => {
    for (const [status, code] of [[429, "RATE_LIMITED"], [503, "SUPPLIER_CHECK_UNAVAILABLE"]] as const) {
      const { client } = capture(() => Response.json({ error: { code, message: "retry" } }, { status }))
      await expect(client.createOrder(createInput)).rejects.toMatchObject({ code, retryable: true, status })
    }
  })

  test("reconciles a timed-out create by the same key and treats only ORDER_NOT_FOUND as absent", async () => {
    const found = capture(() => Response.json({ order: contractOrder }))
    await expect(found.client.getOrderByIdempotencyKey("attempt/1")).resolves.toMatchObject({ id: contractOrder.id })
    expect(new URL(found.requests[0].url).pathname).toBe("/api/partner/v1/orders/by-key/attempt%2F1")

    const missing = capture(() => Response.json({ error: { code: "ORDER_NOT_FOUND", message: "Order not found" } }, { status: 404 }))
    await expect(missing.client.getOrderByIdempotencyKey("attempt-2")).resolves.toBeNull()
  })

  test.each([
    new Response("<html>gateway failure</html>", { status: 502, headers: { "content-type": "text/html" } }),
    new Response("not-json", { status: 200, headers: { "content-type": "application/json" } }),
  ])("fails closed with a controlled provider error for a non-JSON response", async (response) => {
    const client = new GetirBakimClient("https://partner.test", "secret", async () => response.clone())
    const error = await client.quoteOrder([{ selectedOfferId: OFFER_ID, quantity: 1 }]).catch((caught) => caught)
    expect(error).toBeInstanceOf(ProcurementProviderError)
    expect(error).not.toBeInstanceOf(SyntaxError)
  })
})

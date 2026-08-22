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
      return Response.json({ data: { order, replayed: false } }, { status: 201 })
    })
    await client.createOrder({ idempotencyKey: "key", selectedOfferId: "offer_1", quantity: 1, expectedUnitNetKurus: 1000, confirmationToken: "opaque-confirmation-token" })
    expect(request!.headers.get("authorization")).toBe("Bearer secret")
    expect(request!.headers.get("idempotency-key")).toBe("key")
    expect(await request!.json()).toEqual({ selectedOfferId: "offer_1", quantity: 1, expectedUnitNetKurus: 1000, confirmationToken: "opaque-confirmation-token" })
  })

  test("accepts the PR #86 quote shape and preserves its opaque confirmation token", async () => {
    const client = new GetirBakimClient("https://partner.test", "secret", async () => Response.json({ data: { quote: {
      selectedOfferId: "offer_1", quantity: 1, bindingNetKurus: 1000, bindingVatKurus: 200,
      bindingGrossKurus: 1200, unitNetKurus: 1000, currency: "TRY", policyVersion: "opaque-v1",
      expiresAt: "2026-08-21T21:00:00.000Z", confirmationToken: "opaque-confirmation-token",
    } } }))
    await expect(client.quoteOrder("offer_1", 1)).resolves.toMatchObject({ confirmationToken: "opaque-confirmation-token" })
  })

  test("fails closed on confidential or malformed provider responses", async () => {
    const client = new GetirBakimClient("https://partner.test", "secret", async () => Response.json({ data: { ...order, supplierCost: 1 } }))
    await expect(client.getOrder("remote-1")).rejects.toBeInstanceOf(ProcurementProviderError)
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

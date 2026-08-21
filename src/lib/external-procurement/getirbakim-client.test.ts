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
    await client.createOrder({ idempotencyKey: "key", selectedOfferId: "offer_1", quantity: 1, expectedUnitNetKurus: 1000 })
    expect(request!.headers.get("authorization")).toBe("Bearer secret")
    expect(request!.headers.get("idempotency-key")).toBe("key")
    expect(await request!.json()).toEqual({ selectedOfferId: "offer_1", quantity: 1, expectedUnitNetKurus: 1000 })
  })

  test("fails closed on confidential or malformed provider responses", async () => {
    const client = new GetirBakimClient("https://partner.test", "secret", async () => Response.json({ data: { ...order, supplierCost: 1 } }))
    await expect(client.getOrder("remote-1")).rejects.toBeInstanceOf(ProcurementProviderError)
  })
})

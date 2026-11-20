import { describe, expect, test } from "bun:test"
import { contractShippingAddress } from "./contract-v2.fixtures"
import { MockProcurementClient, pricedLine, quoteTotals } from "./mock-client"

describe("MockProcurementClient (contract v2.0)", () => {
  test("uses the contract's per-line VAT arithmetic", () => {
    // Contract example: 1001 × 99 at 20% is 99099 net, 19820 VAT, 118919 gross.
    expect(pricedLine("offer_x", 99, 1001, 2000)).toMatchObject({ lineNetKurus: 99099, lineVatKurus: 19820, lineGrossKurus: 118919 })
    const lines = [pricedLine("offer_x", 2, 13000, 2000)]
    expect(quoteTotals(lines, 5000, 150_000)).toEqual({ netKurus: 26000, vatKurus: 5200, shippingKurus: 5000, grossKurus: 36200 })
    expect(quoteTotals(lines, 5000, 31_200)).toMatchObject({ shippingKurus: 0, grossKurus: 31200 })
  })

  test("replays a known key and follows the DELETE table", async () => {
    const client = new MockProcurementClient()
    const quote = await client.quoteOrder([{ selectedOfferId: "offer_x", quantity: 2 }])
    expect(quote.totals.grossKurus).toBe(quote.totals.netKurus + quote.totals.vatKurus + quote.totals.shippingKurus)
    const input = {
      idempotencyKey: "key-1", confirmationToken: quote.confirmationToken, shippingAddress: contractShippingAddress,
      lines: [{ selectedOfferId: "offer_x", quantity: 2, expectedUnitNetKurus: quote.lines[0].unitNetKurus }],
    }
    const created = await client.createOrder(input)
    expect(created).toMatchObject({ replayed: false, order: { status: "REQUESTED", paymentStatus: "ON_ACCOUNT" } })
    expect(await client.createOrder(input)).toMatchObject({ replayed: true, order: { id: created.order.id } })

    expect(await client.cancelOrder(created.order.id)).toMatchObject({ cancellation: "CANCELLED", order: { status: "CANCELLED", cancelledBy: "PARTNER" } })

    const confirmed = await client.createOrder({ ...input, idempotencyKey: "key-2" })
    client.orders.set(confirmed.order.id, { ...confirmed.order, status: "CONFIRMED" })
    expect(await client.cancelOrder(confirmed.order.id)).toMatchObject({ cancellation: "REQUESTED", order: { status: "CONFIRMED", cancellationRequest: { status: "PENDING" } } })

    const shipped = await client.createOrder({ ...input, idempotencyKey: "key-3" })
    client.orders.set(shipped.order.id, { ...shipped.order, status: "SHIPPED" })
    await expect(client.cancelOrder(shipped.order.id)).rejects.toMatchObject({ code: "ORDER_ALREADY_SHIPPED", status: 409 })
  })
})

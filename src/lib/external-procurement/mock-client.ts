import type { CreateProcurementOrder, ProcurementOrder, ProcurementProviderClient } from "./types"

export class MockProcurementClient implements ProcurementProviderClient {
  readonly provider = "mock"
  readonly orders = new Map<string, ProcurementOrder>()
  readonly idempotency = new Map<string, string>()

  async createOrder(input: CreateProcurementOrder) {
    const existingId = this.idempotency.get(input.idempotencyKey)
    if (existingId) return { order: this.orders.get(existingId)!, replayed: true }
    const now = new Date().toISOString()
    const id = `mock-${this.orders.size + 1}`
    const order: ProcurementOrder = {
      id, status: "REQUESTED", version: 1,
      bindingPrice: {
        netKurus: input.expectedUnitNetKurus * input.quantity,
        vatKurus: Math.round(input.expectedUnitNetKurus * input.quantity / 5),
        grossKurus: Math.round(input.expectedUnitNetKurus * input.quantity * 1.2),
        currency: "TRY", policyVersion: "mock-v1",
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      },
      items: [{
        sourceProductId: "mock-product", selectedOfferId: input.selectedOfferId,
        quantity: input.quantity, unitNetKurus: input.expectedUnitNetKurus,
        unitVatKurus: Math.round(input.expectedUnitNetKurus / 5), unitGrossKurus: Math.round(input.expectedUnitNetKurus * 1.2),
      }],
      cancellationRequested: false, createdAt: now, updatedAt: now,
    }
    this.orders.set(id, order); this.idempotency.set(input.idempotencyKey, id)
    return { order, replayed: false }
  }
  async getOrder(id: string) { return this.required(id) }
  async cancelOrder(id: string) {
    const order = this.required(id)
    const updated = { ...order, status: "CANCELLED" as const, version: order.version + 1, updatedAt: new Date().toISOString() }
    this.orders.set(id, updated); return updated
  }
  private required(id: string) {
    const order = this.orders.get(id)
    if (!order) throw new Error("Mock order not found")
    return order
  }
}

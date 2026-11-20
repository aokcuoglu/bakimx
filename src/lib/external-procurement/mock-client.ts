import {
  ProcurementProviderError,
  type CreateProcurementOrder, type ProcurementOrder, type ProcurementPricedLine,
  type ProcurementProviderClient, type ProcurementQuoteLineRequest, type ProcurementTotals,
} from "./types"

/** Store rule stand-in: a VAT-inclusive fee below the free-shipping threshold (goods gross). */
export const MOCK_SHIPPING_KURUS = 5000
export const MOCK_FREE_SHIPPING_THRESHOLD_KURUS = 150_000
const MOCK_UNIT_NET_KURUS = 1000
const MOCK_VAT_RATE_BPS = 2000

/** Contract v2.0 line arithmetic: VAT once per line, half up. */
export function pricedLine(selectedOfferId: string, quantity: number, unitNetKurus: number, vatRateBps: number): ProcurementPricedLine {
  const lineNetKurus = unitNetKurus * quantity
  const lineVatKurus = Math.round(lineNetKurus * vatRateBps / 10000)
  return { selectedOfferId, quantity, unitNetKurus, vatRateBps, lineNetKurus, lineVatKurus, lineGrossKurus: lineNetKurus + lineVatKurus }
}

export function quoteTotals(lines: ProcurementPricedLine[], shippingFeeKurus = MOCK_SHIPPING_KURUS, freeThresholdKurus = MOCK_FREE_SHIPPING_THRESHOLD_KURUS): ProcurementTotals {
  const netKurus = lines.reduce((sum, line) => sum + line.lineNetKurus, 0)
  const vatKurus = lines.reduce((sum, line) => sum + line.lineVatKurus, 0)
  const shippingKurus = netKurus + vatKurus >= freeThresholdKurus ? 0 : shippingFeeKurus
  return { netKurus, vatKurus, shippingKurus, grossKurus: netKurus + vatKurus + shippingKurus }
}

/** In-memory GetirBakım v2.0 stand-in for development; nothing leaves the process. */
export class MockProcurementClient implements ProcurementProviderClient {
  readonly provider = "mock"
  readonly orders = new Map<string, ProcurementOrder>()
  readonly idempotency = new Map<string, string>()

  async quoteOrder(lines: ProcurementQuoteLineRequest[]) {
    const priced = lines.map((line) => pricedLine(line.selectedOfferId, line.quantity, MOCK_UNIT_NET_KURUS, MOCK_VAT_RATE_BPS))
    return {
      contractVersion: "2.0" as const, lines: priced, totals: quoteTotals(priced), currency: "TRY",
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(), confirmationToken: "mock-confirmation-token",
    }
  }

  async createOrder(input: CreateProcurementOrder) {
    const existingId = this.idempotency.get(input.idempotencyKey)
    if (existingId) return { order: this.required(existingId), replayed: true }
    const id = `mock-${this.orders.size + 1}`
    const lines = input.lines.map((line) => ({
      ...pricedLine(line.selectedOfferId, line.quantity, line.expectedUnitNetKurus, MOCK_VAT_RATE_BPS),
      partNo: "MOCK-PART", name: "Demo parça",
    }))
    const order: ProcurementOrder = {
      contractVersion: "2.0", id, number: 1000 + this.orders.size + 1, idempotencyKey: input.idempotencyKey,
      status: "REQUESTED", paymentStatus: "ON_ACCOUNT", currency: "TRY",
      totals: quoteTotals(lines), lines,
      shippingAddress: { email: null, postalCode: null, ...input.shippingAddress },
      note: input.note ?? "", shipment: null, cancelledBy: null, cancelledAt: null, cancellationRequest: null,
      createdAt: new Date().toISOString(),
    }
    this.orders.set(id, order); this.idempotency.set(input.idempotencyKey, id)
    return { order, replayed: false }
  }

  async getOrder(id: string) { return this.required(id) }

  async getOrderByIdempotencyKey(key: string) {
    const id = this.idempotency.get(key)
    return id ? this.required(id) : null
  }

  /** Mirrors the contract's DELETE table. */
  async cancelOrder(id: string) {
    const order = this.required(id)
    if (order.status === "CANCELLED") return { order, cancellation: "CANCELLED" as const }
    if (order.status === "SHIPPED" || order.status === "COMPLETED") {
      throw new ProcurementProviderError("ORDER_ALREADY_SHIPPED", "The order has shipped.", false, 409)
    }
    const now = new Date().toISOString()
    if (order.status === "CONFIRMED") {
      if (order.cancellationRequest?.status === "REJECTED") {
        throw new ProcurementProviderError("CANCELLATION_REJECTED", "The cancel request was rejected.", false, 409)
      }
      const updated: ProcurementOrder = { ...order, cancellationRequest: order.cancellationRequest ?? { status: "PENDING", requestedAt: now, decidedAt: null } }
      this.orders.set(id, updated)
      return { order: updated, cancellation: "REQUESTED" as const }
    }
    const updated: ProcurementOrder = { ...order, status: "CANCELLED", cancelledBy: "PARTNER", cancelledAt: now }
    this.orders.set(id, updated)
    return { order: updated, cancellation: "CANCELLED" as const }
  }

  private required(id: string) {
    const order = this.orders.get(id)
    if (!order) throw new ProcurementProviderError("ORDER_NOT_FOUND", "Mock order not found", false, 404)
    return order
  }
}

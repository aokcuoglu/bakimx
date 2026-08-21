export const PROCUREMENT_STATUSES = [
  "REQUESTED", "CONFIRMED", "REJECTED", "RESERVATION_EXPIRED",
  "CANCELLED", "SHIPPED", "COMPLETED",
] as const

export type ProcurementStatus = (typeof PROCUREMENT_STATUSES)[number]

export interface ProcurementOrder {
  id: string
  status: ProcurementStatus
  version: number
  bindingPrice: {
    netKurus: number
    vatKurus: number
    grossKurus: number
    currency: string
    policyVersion: string
    expiresAt: string
  }
  items: Array<{
    sourceProductId: string
    selectedOfferId: string
    quantity: number
    unitNetKurus: number
    unitVatKurus: number
    unitGrossKurus: number
  }>
  cancellationRequested: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateProcurementOrder {
  idempotencyKey: string
  selectedOfferId: string
  quantity: number
  expectedUnitNetKurus: number
}

export interface ProcurementProviderClient {
  readonly provider: string
  createOrder(input: CreateProcurementOrder): Promise<{ order: ProcurementOrder; replayed: boolean }>
  getOrder(id: string): Promise<ProcurementOrder>
  cancelOrder(id: string): Promise<ProcurementOrder>
}

export class ProcurementProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) { super(message) }
}

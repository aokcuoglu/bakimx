import { z } from "zod"
import {
  CANCELLATION_REQUEST_STATUSES, MAX_PROCUREMENT_LINE_QUANTITY, MAX_PROCUREMENT_LINES,
  PROCUREMENT_CANCELLED_BY, PROCUREMENT_CONTRACT_VERSION, PROCUREMENT_STATUSES, ProcurementProviderError,
  type CreateProcurementOrder, type ProcurementProviderClient, type ProcurementQuoteLineRequest,
} from "./types"

/*
 * GetirBakım partner order contract v2.0 (issue #751). Every response object is
 * strict: an unexpected field (a supplier cost, a raw payload…) fails closed
 * instead of being stored or shown.
 */
const kurus = z.number().int().nonnegative()
const timestamp = z.string().datetime()

const totalsSchema = z.object({
  netKurus: kurus, vatKurus: kurus, shippingKurus: kurus, grossKurus: kurus,
}).strict()

const pricedLineShape = {
  selectedOfferId: z.string().min(1), quantity: z.number().int().positive(),
  unitNetKurus: kurus, vatRateBps: kurus,
  lineNetKurus: kurus, lineVatKurus: kurus, lineGrossKurus: kurus,
}

export const procurementOrderSchema = z.object({
  contractVersion: z.literal(PROCUREMENT_CONTRACT_VERSION),
  id: z.string().min(1),
  number: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(1),
  status: z.enum(PROCUREMENT_STATUSES),
  paymentStatus: z.literal("ON_ACCOUNT"),
  currency: z.string().length(3),
  totals: totalsSchema,
  lines: z.array(z.object({ ...pricedLineShape, partNo: z.string(), name: z.string() }).strict()).min(1),
  // Stored addresses are echoed as saved; columns are nullable on GetirBakım's side.
  shippingAddress: z.object({
    recipientName: z.string(), phone: z.string(), email: z.string().nullable(),
    province: z.string().nullable(), district: z.string().nullable(),
    addressLine: z.string().nullable(), postalCode: z.string().nullable(),
  }).strict(),
  note: z.string(),
  shipment: z.object({
    carrier: z.string().nullable(), trackingNo: z.string().nullable(), trackingUrl: z.string().nullable(),
    shippedAt: timestamp.nullable(), deliveredAt: timestamp.nullable(),
  }).strict().nullable(),
  cancelledBy: z.enum(PROCUREMENT_CANCELLED_BY).nullable(),
  cancelledAt: timestamp.nullable(),
  cancellationRequest: z.object({
    status: z.enum(CANCELLATION_REQUEST_STATUSES), requestedAt: timestamp, decidedAt: timestamp.nullable(),
  }).strict().nullable(),
  createdAt: timestamp,
}).strict().transform((order) => ({
  ...order,
  shippingAddress: {
    ...order.shippingAddress,
    province: order.shippingAddress.province ?? "",
    district: order.shippingAddress.district ?? "",
    addressLine: order.shippingAddress.addressLine ?? "",
  },
}))

export const procurementQuoteSchema = z.object({
  contractVersion: z.literal(PROCUREMENT_CONTRACT_VERSION),
  lines: z.array(z.object(pricedLineShape).strict()).min(1).max(MAX_PROCUREMENT_LINES),
  totals: totalsSchema,
  currency: z.string().length(3),
  expiresAt: timestamp,
  confirmationToken: z.string().min(1),
}).strict()

const orderEnvelope = z.object({ order: procurementOrderSchema }).strict()
const createSchema = z.object({ order: procurementOrderSchema, replayed: z.boolean() }).strict()
const quoteEnvelope = z.object({ quote: procurementQuoteSchema }).strict()
const cancelSchema = z.object({ order: procurementOrderSchema, cancellation: z.enum(["CANCELLED", "REQUESTED"]) }).strict()

const errorSchema = z.object({
  error: z.object({
    code: z.string(), message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }).passthrough(),
  // The 1.0 pilot put details beside `error`; still read it if a proxy does.
  details: z.record(z.string(), z.unknown()).optional(),
}).passthrough()

function assertQuoteLines(lines: ProcurementQuoteLineRequest[]) {
  const offers = new Set(lines.map((line) => line.selectedOfferId))
  const valid = lines.length >= 1 && lines.length <= MAX_PROCUREMENT_LINES && offers.size === lines.length
    && lines.every((line) => Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= MAX_PROCUREMENT_LINE_QUANTITY)
  if (!valid) throw new ProcurementProviderError("VALIDATION_ERROR", "Invalid procurement lines.", false, 400)
}

export class GetirBakimClient implements ProcurementProviderClient {
  readonly provider = "getirbakim"
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    if (!baseUrl || !apiKey) throw new Error("GetirBakim client configuration is unavailable")
  }

  async quoteOrder(lines: ProcurementQuoteLineRequest[]) {
    assertQuoteLines(lines)
    const result = await this.request("/api/partner/v1/order-quotes", quoteEnvelope, {
      method: "POST",
      body: JSON.stringify({ lines: lines.map(({ selectedOfferId, quantity }) => ({ selectedOfferId, quantity })) }),
    })
    return result.quote
  }

  createOrder(input: CreateProcurementOrder) {
    assertQuoteLines(input.lines)
    const address = input.shippingAddress
    const note = input.note?.trim()
    return this.request("/api/partner/v1/orders", createSchema, {
      method: "POST", headers: { "idempotency-key": input.idempotencyKey },
      // The body is strict on GetirBakım's side: only contract fields, optional ones omitted when empty.
      body: JSON.stringify({
        confirmationToken: input.confirmationToken,
        lines: input.lines.map(({ selectedOfferId, quantity, expectedUnitNetKurus }) => ({ selectedOfferId, quantity, expectedUnitNetKurus })),
        shippingAddress: {
          recipientName: address.recipientName, phone: address.phone,
          ...(address.email ? { email: address.email } : {}),
          province: address.province, district: address.district, addressLine: address.addressLine,
          ...(address.postalCode ? { postalCode: address.postalCode } : {}),
        },
        ...(note ? { note } : {}),
      }),
    })
  }

  async getOrder(id: string) {
    const result = await this.request(`/api/partner/v1/orders/${encodeURIComponent(id)}`, orderEnvelope)
    return result.order
  }

  async getOrderByIdempotencyKey(key: string) {
    try {
      const result = await this.request(`/api/partner/v1/orders/by-key/${encodeURIComponent(key)}`, orderEnvelope)
      return result.order
    } catch (error) {
      if (error instanceof ProcurementProviderError && error.status === 404 && error.code === "ORDER_NOT_FOUND") return null
      throw error
    }
  }

  cancelOrder(id: string) {
    return this.request(`/api/partner/v1/orders/${encodeURIComponent(id)}`, cancelSchema, { method: "DELETE" })
  }

  private async request<T extends z.ZodType>(path: string, schema: T, init: RequestInit = {}): Promise<z.infer<T>> {
    let response: Response
    try {
      response = await this.fetcher(new URL(path, this.baseUrl), {
        ...init, signal: AbortSignal.timeout(10_000),
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json", ...init.headers },
      })
    } catch {
      throw new ProcurementProviderError("PROVIDER_UNAVAILABLE", "Procurement provider is unavailable.", true)
    }
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const error = errorSchema.safeParse(body)
      throw new ProcurementProviderError(
        error.success ? error.data.error.code : "PROVIDER_ERROR",
        error.success ? error.data.error.message : "Procurement provider rejected the request.",
        response.status === 429 || response.status >= 500, response.status,
        error.success ? error.data.error.details ?? error.data.details : undefined,
      )
    }
    const parsed = schema.safeParse(body)
    if (!parsed.success) throw new ProcurementProviderError("INVALID_PROVIDER_RESPONSE", "Invalid provider response.", false)
    return parsed.data
  }
}

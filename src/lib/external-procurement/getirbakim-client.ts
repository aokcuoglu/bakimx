import { z } from "zod"
import {
  PROCUREMENT_STATUSES, ProcurementProviderError,
  type CreateProcurementOrder, type ProcurementProviderClient,
} from "./types"

const orderSchema = z.object({
  contractVersion: z.literal("1.0"), id: z.string().min(1),
  status: z.enum(PROCUREMENT_STATUSES), version: z.number().int().nonnegative(),
  bindingPrice: z.object({
    netKurus: z.number().int().nonnegative(), vatKurus: z.number().int().nonnegative(),
    grossKurus: z.number().int().nonnegative(), currency: z.string().min(3).max(3),
    policyVersion: z.string().min(1), expiresAt: z.string().datetime(),
  }),
  items: z.array(z.object({
    sourceProductId: z.string(), selectedOfferId: z.string(), quantity: z.number().int().positive(),
    unitNetKurus: z.number().int().nonnegative(), unitVatKurus: z.number().int().nonnegative(),
    unitGrossKurus: z.number().int().nonnegative(),
  })).min(1),
  cancellationRequested: z.boolean(), createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
}).strict()

const createSchema = z.object({ order: orderSchema, replayed: z.boolean() }).strict()
const quoteSchema = z.object({ quote: z.object({
  selectedOfferId: z.string(), quantity: z.number().int().positive(),
  bindingNetKurus: z.number().int().nonnegative(), bindingVatKurus: z.number().int().nonnegative(),
  bindingGrossKurus: z.number().int().nonnegative(), unitNetKurus: z.number().int().nonnegative(),
  currency: z.string().length(3), policyVersion: z.string(), expiresAt: z.string().datetime(),
}).strict() }).strict()

export class GetirBakimClient implements ProcurementProviderClient {
  readonly provider = "getirbakim"
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    if (!baseUrl || !apiKey) throw new Error("GetirBakim client configuration is unavailable")
  }

  createOrder(input: CreateProcurementOrder) {
    return this.request("/api/partner/v1/orders", createSchema, {
      method: "POST", headers: { "idempotency-key": input.idempotencyKey },
      body: JSON.stringify({
        selectedOfferId: input.selectedOfferId, quantity: input.quantity,
        expectedUnitNetKurus: input.expectedUnitNetKurus,
      }),
    })
  }

  async quoteOrder(selectedOfferId: string, quantity: number) {
    const result = await this.request("/api/partner/v1/order-quotes", quoteSchema, {
      method: "POST", body: JSON.stringify({ selectedOfferId, quantity }),
    })
    return result.quote
  }

  getOrder(id: string) { return this.request(`/api/partner/v1/orders/${encodeURIComponent(id)}`, orderSchema) }
  cancelOrder(id: string) {
    return this.request(`/api/partner/v1/orders/${encodeURIComponent(id)}`, orderSchema, { method: "DELETE" })
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
      const error = z.object({ error: z.object({ code: z.string(), message: z.string(), details: z.record(z.string(), z.unknown()).optional() }) }).safeParse(body)
      throw new ProcurementProviderError(
        error.success ? error.data.error.code : "PROVIDER_ERROR",
        error.success ? error.data.error.message : "Procurement provider rejected the request.",
        response.status === 429 || response.status >= 500, response.status,
        error.success ? error.data.error.details : undefined,
      )
    }
    const envelope = z.object({ data: z.unknown() }).safeParse(body)
    const parsed = envelope.success ? schema.safeParse(envelope.data.data) : null
    if (!parsed?.success) throw new ProcurementProviderError("INVALID_PROVIDER_RESPONSE", "Invalid provider response.", false)
    return parsed.data
  }
}

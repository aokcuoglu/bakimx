import { z } from "zod"
import { readJsonObject } from "@/lib/http/json-response"

const errorResponseSchema = z.object({
  error: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
})

const offerSchema = z.object({
  selectedOfferId: z.string().min(1),
  supplierDisplayName: z.string().min(1),
  informationalPriceKurus: z.number().int().nonnegative().nullable(),
  currency: z.string().min(1),
  vatRateBps: z.number().int().nonnegative(),
  availability: z.enum(["IN_STOCK", "SUPPLYABLE", "UNKNOWN"]),
  stockQty: z.number().int().nonnegative().nullable(),
  lastSyncedAt: z.string().nullable(),
})

const productSchema = z.object({
  sourceProductId: z.string().min(1),
  brandName: z.string(),
  manufacturerPartNumber: z.object({ value: z.string().min(1), normalized: z.string().min(1) }),
  offers: z.array(offerSchema),
})

export const offerResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.enum(["matched", "no_offers"]), normalizedPartNo: z.string(), products: z.array(productSchema) }),
  z.object({ status: z.enum(["no_match", "upstream_error"]), normalizedPartNo: z.string() }),
]).superRefine((result, context) => {
  if (result.status === "matched" && !result.products.some((product) => product.offers.length > 0)) {
    context.addIssue({ code: "custom", message: "Matched responses require an offer." })
  }
  if (result.status === "no_offers" && (result.products.length === 0 || result.products.some((product) => product.offers.length > 0))) {
    context.addIssue({ code: "custom", message: "No-offers responses require products without offers." })
  }
})

const quoteSchema = z.object({
  bindingNetKurus: z.number().int().nonnegative(),
  bindingVatKurus: z.number().int().nonnegative(),
  bindingGrossKurus: z.number().int().nonnegative(),
  unitNetKurus: z.number().int().nonnegative(),
  currency: z.string().min(1),
  policyVersion: z.string().min(1),
  expiresAt: z.string().datetime(),
  confirmationToken: z.string().min(1),
})

export const quoteResponseSchema = z.object({ quote: quoteSchema })
export const purchaseResponseSchema = z.object({ procurement: z.object({
  id: z.string().min(1),
  externalOrderId: z.string().min(1),
  partnerStatus: z.literal("REQUESTED"),
}) })

export type OfferResponse = z.infer<typeof offerResponseSchema>
export type Quote = z.infer<typeof quoteSchema>

export class SupplierResponseError extends Error {
  constructor(message: string, readonly code?: string) { super(message) }
}

async function readFailure(response: Response, fallback: string): Promise<never> {
  const data = await readJsonObject(response, errorResponseSchema)
  throw new SupplierResponseError(data.error ?? fallback, data.code)
}

export async function readOfferResponse(response: Response): Promise<OfferResponse> {
  if (!response.ok) return readFailure(response, "Teklifler şu anda alınamıyor.")
  return readJsonObject(response, offerResponseSchema)
}

export async function readQuoteResponse(response: Response): Promise<Quote> {
  if (!response.ok) return readFailure(response, "Bağlayıcı fiyat alınamadı.")
  return (await readJsonObject(response, quoteResponseSchema)).quote
}

export async function readPurchaseResponse(response: Response): Promise<void> {
  if (!response.ok) return readFailure(response, "Satın alma talebi oluşturulamadı.")
  await readJsonObject(response, purchaseResponseSchema)
}

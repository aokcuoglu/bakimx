import { NextResponse } from "next/server"
import { z } from "zod"
import { requireWritableWorkshop } from "@/lib/auth"
import { assertFeature } from "@/lib/plan"
import { prisma } from "@/lib/db"
import { getProcurementProvider } from "@/lib/external-procurement/provider"
import { cancelExternalProcurement, reconcileExternalProcurement, startExternalProcurement } from "@/lib/external-procurement/service"
import { requireWorkshopShippingAddress } from "@/lib/external-procurement/shipping-address"
import { MAX_PROCUREMENT_LINE_QUANTITY, ProcurementProviderError, procurementErrorMessage } from "@/lib/external-procurement/types"
import { apiErrorResponse } from "@/lib/api-errors"

const quantity = z.number().int().positive().max(MAX_PROCUREMENT_LINE_QUANTITY)
const quoteSchema = z.object({ action: z.literal("quote"), selectedOfferId: z.string().min(1), quantity }).strict()
const cancelSchema = z.object({ action: z.literal("cancel"), procurementId: z.string().min(1) }).strict()
// Contract v2.0 has no webhooks: the work order pulls GET /orders/:id on demand.
const refreshSchema = z.object({ action: z.literal("refresh"), procurementId: z.string().min(1) }).strict()
const purchaseSchema = z.object({
  action: z.literal("purchase"), orderId: z.string().min(1), orderItemId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(128), externalProductId: z.string().min(1),
  selectedOfferId: z.string().min(1), quantity,
  expectedUnitNetKurus: z.number().int().positive(),
  confirmationToken: z.string().min(1),
  productPresentation: z.object({ name: z.string().min(1), brand: z.string().optional(), partNumber: z.string().optional() }).strict(),
  informationalSnapshot: z.object({ unitPriceKurus: z.number().int().nonnegative().optional(), currency: z.string().optional(), availability: z.string().optional(), capturedAt: z.string().datetime() }).strict().optional(),
}).strict()

export async function POST(request: Request) {
  try {
    const { user, workshop } = await requireWritableWorkshop("parts.purchase")
    const body: unknown = await request.json()
    const provider = getProcurementProvider()
    const cancel = cancelSchema.safeParse(body)
    if (cancel.success) {
      const result = await cancelExternalProcurement(provider, workshop.id, cancel.data.procurementId)
      return NextResponse.json({ cancellation: result.cancellation, procurement: { status: result.order.status } })
    }
    const refresh = refreshSchema.safeParse(body)
    if (refresh.success) {
      const result = await reconcileExternalProcurement(provider, workshop.id, refresh.data.procurementId)
      return NextResponse.json({ applied: result.applied, procurement: { status: result.order.status } })
    }
    assertFeature(workshop, "procurement")
    const quote = quoteSchema.safeParse(body)
    if (quote.success) {
      // Fail before showing a binding price the order could not be placed with.
      requireWorkshopShippingAddress(workshop)
      return NextResponse.json({ quote: await provider.quoteOrder([{ selectedOfferId: quote.data.selectedOfferId, quantity: quote.data.quantity }]) })
    }
    const purchase = purchaseSchema.safeParse(body)
    if (!purchase.success) return NextResponse.json({ error: "Geçersiz satın alma isteği." }, { status: 400 })
    const data = purchase.data
    const shippingAddress = requireWorkshopShippingAddress(workshop)
    const item = await prisma.serviceOrderItem.findFirst({ where: { id: data.orderItemId, serviceOrderId: data.orderId, workshopId: workshop.id, serviceOrder: { workshopId: workshop.id } }, select: { id: true } })
    if (!item) return NextResponse.json({ error: "İş emri kalemi bulunamadı." }, { status: 404 })
    const result = await startExternalProcurement(provider, {
      workshopId: workshop.id, requestedByUserId: user.id, serviceOrderId: data.orderId,
      serviceOrderItemId: data.orderItemId, idempotencyKey: data.idempotencyKey,
      externalProductId: data.externalProductId, externalOfferId: data.selectedOfferId,
      quantity: data.quantity, expectedUnitNetKurus: data.expectedUnitNetKurus,
      confirmationToken: data.confirmationToken, shippingAddress,
      productPresentation: data.productPresentation, informationalSnapshot: data.informationalSnapshot,
    })
    return NextResponse.json({ procurement: result }, { status: 201 })
  } catch (error) {
    if (error instanceof ProcurementProviderError) {
      // Provider messages are English and meant for logs; the workshop sees Turkish.
      const message = error.code === "SHIPPING_ADDRESS_INCOMPLETE" ? error.message : procurementErrorMessage(error.code)
      return NextResponse.json({ error: message, code: error.code, details: error.details }, { status: error.status ?? 502 })
    }
    return apiErrorResponse(error)
  }
}

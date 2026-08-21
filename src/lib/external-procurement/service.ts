import { createHash } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { requireWritableWorkshop } from "@/lib/auth"
import {
  ProcurementProviderError, type ProcurementOrder, type ProcurementProviderClient,
} from "./types"

export interface StartProcurementInput {
  workshopId: string
  serviceOrderId: string
  serviceOrderItemId: string
  requestedByUserId: string
  idempotencyKey: string
  externalProductId: string
  externalOfferId: string
  quantity: number
  expectedUnitNetKurus: number
  productPresentation: { name: string; brand?: string; partNumber?: string; imageUrl?: string }
  informationalSnapshot?: { unitPriceKurus?: number; currency?: string; availability?: string; capturedAt: string }
}

export type UntrustedProcurementInput = Omit<StartProcurementInput, "workshopId" | "requestedByUserId">

/** Session-derived identity wrapper for route/actions accepting request data. */
export async function startAuthorizedExternalProcurement(
  client: ProcurementProviderClient, input: UntrustedProcurementInput,
) {
  const { user, workshop } = await requireWritableWorkshop("parts.purchase")
  return startExternalProcurement(client, {
    ...input, workshopId: workshop.id, requestedByUserId: user.id,
  })
}

export function procurementRequestHash(input: StartProcurementInput): string {
  return createHash("sha256").update(JSON.stringify({
    serviceOrderId: input.serviceOrderId, serviceOrderItemId: input.serviceOrderItemId,
    externalProductId: input.externalProductId, externalOfferId: input.externalOfferId,
    quantity: input.quantity, expectedUnitNetKurus: input.expectedUnitNetKurus,
  })).digest("hex")
}

function projection(order: ProcurementOrder) {
  return {
    externalOrderId: order.id, partnerStatus: order.status, partnerVersion: order.version,
    bindingNetKurus: order.bindingPrice.netKurus, bindingVatKurus: order.bindingPrice.vatKurus,
    bindingGrossKurus: order.bindingPrice.grossKurus, currency: order.bindingPrice.currency,
    pricingPolicyVersion: order.bindingPrice.policyVersion,
    reservationExpiresAt: new Date(order.bindingPrice.expiresAt), failureCode: null,
    failedAt: null, lastReconciledAt: new Date(),
  } satisfies Prisma.ExternalProcurementOrderUpdateManyMutationInput
}

function itemProjection(order: ProcurementOrder) {
  const item = order.items[0]
  if (!item) return null
  return {
    externalProductId: item.sourceProductId, externalOfferId: item.selectedOfferId,
    quantity: item.quantity, unitNetKurus: item.unitNetKurus,
    unitVatKurus: item.unitVatKurus, unitGrossKurus: item.unitGrossKurus,
  }
}

/**
 * Trusted application boundary. Callers must derive workshop/user identity from
 * requireWritableWorkshop("parts.purchase"), never from a request body.
 */
export async function startExternalProcurement(client: ProcurementProviderClient, input: StartProcurementInput) {
  if (input.quantity <= 0 || !Number.isInteger(input.quantity)) throw new Error("Invalid procurement quantity")
  const requestHash = procurementRequestHash(input)
  const existing = await prisma.externalProcurementOrder.findUnique({
    where: { provider_workshopId_idempotencyKey: {
      provider: client.provider, workshopId: input.workshopId, idempotencyKey: input.idempotencyKey,
    } }, include: { items: true },
  })
  if (existing) {
    if (existing.requestHash !== requestHash) throw new ProcurementProviderError("IDEMPOTENCY_CONFLICT", "Idempotency key was used for another request.", false, 409)
    if (existing.externalOrderId) return existing
  }

  const local = existing ?? await prisma.$transaction(async (tx) => {
    const item = await tx.serviceOrderItem.findFirst({
      where: {
        id: input.serviceOrderItemId, workshopId: input.workshopId,
        serviceOrderId: input.serviceOrderId,
        serviceOrder: { workshopId: input.workshopId },
      }, select: { id: true, partId: true },
    })
    if (!item) throw new Error("Service order item not found")
    if (item.partId !== null) throw new Error("External procurement cannot mutate or reserve local inventory")
    return tx.externalProcurementOrder.create({
      data: {
        provider: client.provider, workshopId: input.workshopId,
        serviceOrderId: input.serviceOrderId, requestedByUserId: input.requestedByUserId,
        idempotencyKey: input.idempotencyKey, requestHash, partnerStatus: "INITIATING",
        items: { create: {
          serviceOrderItemId: input.serviceOrderItemId, externalProductId: input.externalProductId,
          externalOfferId: input.externalOfferId, quantity: input.quantity,
          productPresentationSnapshot: input.productPresentation,
          informationalSnapshot: input.informationalSnapshot,
        } },
      }, include: { items: true },
    })
  })

  try {
    let result
    try {
      result = await client.createOrder({
        idempotencyKey: input.idempotencyKey, selectedOfferId: input.externalOfferId,
        quantity: input.quantity, expectedUnitNetKurus: input.expectedUnitNetKurus,
      })
    } catch (error) {
      if (!(error instanceof ProcurementProviderError) || !error.retryable) throw error
      // The same provider idempotency key safely reconciles an ambiguous first attempt.
      result = await client.createOrder({
        idempotencyKey: input.idempotencyKey, selectedOfferId: input.externalOfferId,
        quantity: input.quantity, expectedUnitNetKurus: input.expectedUnitNetKurus,
      })
    }
    return await prisma.$transaction(async (tx) => {
      await tx.externalProcurementOrder.update({ where: { id: local.id }, data: projection(result.order) })
      const item = itemProjection(result.order)
      if (item) await tx.externalProcurementOrderItem.updateMany({
        where: { externalProcurementOrderId: local.id }, data: item,
      })
      return tx.externalProcurementOrder.findUniqueOrThrow({ where: { id: local.id }, include: { items: true } })
    })
  } catch (error) {
    const code = error instanceof ProcurementProviderError ? error.code : "PROVIDER_UNAVAILABLE"
    await prisma.externalProcurementOrder.update({
      where: { id: local.id }, data: { partnerStatus: "FAILED", failureCode: code, failedAt: new Date() },
    })
    throw error
  }
}

export async function reconcileExternalProcurement(
  client: ProcurementProviderClient, workshopId: string, localId: string,
) {
  const local = await prisma.externalProcurementOrder.findFirst({
    where: { id: localId, workshopId, provider: client.provider },
  })
  if (!local?.externalOrderId) throw new Error("Procurement order not found")
  const remote = await client.getOrder(local.externalOrderId)
  const result = await prisma.externalProcurementOrder.updateMany({
    where: { id: local.id, workshopId, partnerVersion: { lt: remote.version } },
    data: projection(remote),
  })
  return { applied: result.count === 1, order: remote }
}

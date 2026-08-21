import { createHash } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { requireWritableWorkshop } from "@/lib/auth"
import {
  PROCUREMENT_STATUSES, ProcurementProviderError, requiresProcurementReconfirmation,
  type ProcurementOrder, type ProcurementProviderClient,
} from "./types"

const TERMINAL_STATUSES = new Set<string>(["REJECTED", "RESERVATION_EXPIRED", "CANCELLED", "COMPLETED"])
const RECONCILE_INTERVAL_MS = 5 * 60 * 1000
const RECONCILE_LEASE_MS = 2 * 60 * 1000
export const MANUAL_RECONCILE_FAILURE_THRESHOLD = 5

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
  confirmationToken: string
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
    confirmationToken: input.confirmationToken,
  })).digest("hex")
}

function projection(order: ProcurementOrder, cancellationRequestedAt: Date | null) {
  const now = new Date()
  return {
    externalOrderId: order.id, partnerStatus: order.status, partnerVersion: order.version,
    bindingNetKurus: order.bindingPrice.netKurus, bindingVatKurus: order.bindingPrice.vatKurus,
    bindingGrossKurus: order.bindingPrice.grossKurus, currency: order.bindingPrice.currency,
    pricingPolicyVersion: order.bindingPrice.policyVersion,
    reservationExpiresAt: new Date(order.bindingPrice.expiresAt), failureCode: null,
    cancellationRequestedAt: order.cancellationRequested ? cancellationRequestedAt ?? now : cancellationRequestedAt,
    failedAt: null, lastReconciledAt: now,
    nextReconcileAt: TERMINAL_STATUSES.has(order.status) ? null : new Date(now.getTime() + RECONCILE_INTERVAL_MS),
    reconcileFailureCount: 0, lastReconcileError: null, manualReconcileRequiredAt: null,
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

/** Apply a provider projection once, atomically with its item, iff its version is newer. */
export async function applyExternalProcurementProjection(
  tx: Prisma.TransactionClient,
  localId: string,
  order: ProcurementOrder,
) {
  const local = await tx.externalProcurementOrder.findUnique({
    where: { id: localId }, select: { externalOrderId: true, partnerVersion: true, cancellationRequestedAt: true },
  })
  if (!local) return false
  if (local.externalOrderId && local.externalOrderId !== order.id) throw new Error("Provider order identity mismatch")
  if (local.externalOrderId && local.partnerVersion >= order.version) return false

  const result = await tx.externalProcurementOrder.updateMany({
    where: {
      id: localId,
      ...(local.externalOrderId
        ? { externalOrderId: order.id, partnerVersion: { lt: order.version } }
        : { externalOrderId: null, partnerVersion: { lte: order.version } }),
    },
    data: projection(order, local.cancellationRequestedAt),
  })
  if (result.count !== 1) return false
  const item = itemProjection(order)
  if (item) await tx.externalProcurementOrderItem.updateMany({
    where: { externalProcurementOrderId: localId }, data: item,
  })
  return true
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
        confirmationToken: input.confirmationToken,
      })
    } catch (error) {
      if (!(error instanceof ProcurementProviderError) || !error.retryable) throw error
      // The same provider idempotency key safely reconciles an ambiguous first attempt.
      result = await client.createOrder({
        idempotencyKey: input.idempotencyKey, selectedOfferId: input.externalOfferId,
        quantity: input.quantity, expectedUnitNetKurus: input.expectedUnitNetKurus,
        confirmationToken: input.confirmationToken,
      })
    }
    return await prisma.$transaction(async (tx) => {
      await applyExternalProcurementProjection(tx, local.id, result.order)
      return tx.externalProcurementOrder.findUniqueOrThrow({ where: { id: local.id }, include: { items: true } })
    })
  } catch (error) {
    if (error instanceof ProcurementProviderError && requiresProcurementReconfirmation(error.code)) {
      await prisma.externalProcurementOrder.delete({ where: { id: local.id } })
      throw error
    }
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
  const applied = await prisma.$transaction((tx) => applyExternalProcurementProjection(tx, local.id, remote))
  return { applied, order: remote }
}

export async function cancelExternalProcurement(
  client: ProcurementProviderClient, workshopId: string, localId: string,
) {
  const local = await prisma.externalProcurementOrder.findFirst({
    where: { id: localId, workshopId, provider: client.provider },
  })
  if (!local?.externalOrderId) throw new Error("Procurement order not found")
  const remote = await client.cancelOrder(local.externalOrderId)
  await prisma.$transaction((tx) => applyExternalProcurementProjection(tx, local.id, remote))
  return remote
}

export function reconcileBackoffMs(failureCount: number): number {
  return Math.min(60 * 60 * 1000, 60_000 * 2 ** Math.min(Math.max(failureCount - 1, 0), 6))
}

export function pollCompletionGuard(row: { id: string; partnerVersion: number }, leaseUntil: Date) {
  return { id: row.id, partnerVersion: row.partnerVersion, nextReconcileAt: leaseUntil } as const
}

export async function sweepExternalProcurements(
  client: ProcurementProviderClient,
  options: { limit?: number; now?: Date } = {},
) {
  const now = options.now ?? new Date()
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100)
  const rows = await prisma.externalProcurementOrder.findMany({
    where: {
      provider: client.provider, externalOrderId: { not: null },
      partnerStatus: { in: PROCUREMENT_STATUSES.filter((status) => !TERMINAL_STATUSES.has(status)) },
      OR: [{ nextReconcileAt: null }, { nextReconcileAt: { lte: now } }],
    },
    orderBy: [{ nextReconcileAt: "asc" }, { updatedAt: "asc" }], take: limit,
    select: { id: true, externalOrderId: true, partnerVersion: true, reconcileFailureCount: true },
  })
  let processed = 0
  let applied = 0
  let failed = 0
  for (const row of rows) {
    const leaseUntil = new Date(now.getTime() + RECONCILE_LEASE_MS)
    const claimed = await prisma.externalProcurementOrder.updateMany({
      where: {
        id: row.id, partnerVersion: row.partnerVersion,
        OR: [{ nextReconcileAt: null }, { nextReconcileAt: { lte: now } }],
      },
      data: { nextReconcileAt: leaseUntil },
    })
    if (claimed.count !== 1) continue
    processed += 1
    try {
      const remote = await client.getOrder(row.externalOrderId!)
      if (await prisma.$transaction((tx) => applyExternalProcurementProjection(tx, row.id, remote))) applied += 1
      else await prisma.externalProcurementOrder.updateMany({
        where: pollCompletionGuard(row, leaseUntil),
        data: { lastReconciledAt: now, nextReconcileAt: TERMINAL_STATUSES.has(remote.status) ? null : new Date(now.getTime() + RECONCILE_INTERVAL_MS), reconcileFailureCount: 0, lastReconcileError: null, manualReconcileRequiredAt: null },
      })
    } catch (error) {
      failed += 1
      const nextFailureCount = row.reconcileFailureCount + 1
      const code = error instanceof ProcurementProviderError ? error.code : "RECONCILE_FAILED"
      await prisma.externalProcurementOrder.updateMany({
        where: pollCompletionGuard(row, leaseUntil),
        data: {
          reconcileFailureCount: nextFailureCount, lastReconcileError: code,
          nextReconcileAt: new Date(now.getTime() + reconcileBackoffMs(nextFailureCount)),
          ...(nextFailureCount >= MANUAL_RECONCILE_FAILURE_THRESHOLD && { manualReconcileRequiredAt: now }),
        },
      })
    }
  }
  return { processed, applied, failed }
}

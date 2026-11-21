import { createHash } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { requireWritableWorkshop } from "@/lib/auth"
import { requireWorkshopShippingAddress } from "./shipping-address"
import {
  MAX_PROCUREMENT_LINE_QUANTITY, PROCUREMENT_STATUSES, ProcurementProviderError, TERMINAL_PROCUREMENT_STATUSES,
  releasesProcurementAttempt, requiresProcurementReconfirmation,
  type ProcurementOrder, type ProcurementProviderClient, type ProcurementShippingAddress, type ProcurementStatus,
} from "./types"

const RECONCILE_INTERVAL_MS = 5 * 60 * 1000
const RECONCILE_LEASE_MS = 2 * 60 * 1000
const INITIATING_MAX_AGE_MS = 60 * 60 * 1000
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
  /** Built server-side from the workshop profile (requireWorkshopShippingAddress), never from a request body. */
  shippingAddress: ProcurementShippingAddress
  note?: string
  productPresentation: { name: string; brand?: string; partNumber?: string; imageUrl?: string }
  informationalSnapshot?: { unitPriceKurus?: number; currency?: string; availability?: string; capturedAt: string }
}

export type UntrustedProcurementInput = Omit<StartProcurementInput, "workshopId" | "requestedByUserId" | "shippingAddress">

/** Session-derived identity wrapper for route/actions accepting request data. */
export async function startAuthorizedExternalProcurement(
  client: ProcurementProviderClient, input: UntrustedProcurementInput,
) {
  const { user, workshop } = await requireWritableWorkshop("parts.purchase")
  return startExternalProcurement(client, {
    ...input, workshopId: workshop.id, requestedByUserId: user.id,
    shippingAddress: requireWorkshopShippingAddress(workshop),
  })
}

export function procurementRequestHash(input: StartProcurementInput): string {
  return createHash("sha256").update(JSON.stringify({
    serviceOrderId: input.serviceOrderId, serviceOrderItemId: input.serviceOrderItemId,
    externalProductId: input.externalProductId, externalOfferId: input.externalOfferId,
    quantity: input.quantity, expectedUnitNetKurus: input.expectedUnitNetKurus,
    confirmationToken: input.confirmationToken,
    shippingAddress: input.shippingAddress, note: input.note ?? "",
  })).digest("hex")
}

/**
 * Local summary of the contract's cancellation fields, kept in
 * `ExternalProcurementOrder.cancellationCode` (no schema change needed).
 */
export const PROCUREMENT_CANCELLATION_CODES = [
  "REQUEST_PENDING", "REQUEST_REJECTED", "CANCELLED_BY_PARTNER", "CANCELLED_BY_GETIRBAKIM",
] as const
export type ProcurementCancellationCode = (typeof PROCUREMENT_CANCELLATION_CODES)[number]

export function procurementCancellationCode(order: Pick<ProcurementOrder, "status" | "cancelledBy" | "cancellationRequest">): ProcurementCancellationCode | null {
  if (order.status === "CANCELLED") return order.cancelledBy === "GETIRBAKIM" ? "CANCELLED_BY_GETIRBAKIM" : "CANCELLED_BY_PARTNER"
  if (order.cancellationRequest?.status === "PENDING") return "REQUEST_PENDING"
  if (order.cancellationRequest?.status === "REJECTED") return "REQUEST_REJECTED"
  return null
}

const STATUS_RANK: Record<ProcurementStatus, number> = { REQUESTED: 1, CONFIRMED: 2, SHIPPED: 3, COMPLETED: 4, CANCELLED: 5 }

/**
 * Contract v2.0 has no order version, so `partnerVersion` stores a revision
 * derived from the order's lifecycle. Every transition the contract allows —
 * REQUESTED→CONFIRMED→SHIPPED→COMPLETED, REQUESTED|CONFIRMED→CANCELLED, a cancel
 * request PENDING→APPROVED|REJECTED, a shipment appearing — strictly raises it,
 * so the projector still ignores a stale or repeated answer. (1.0 rows had
 * versions < 100 and are always superseded.)
 */
export function procurementOrderRevision(order: Pick<ProcurementOrder, "status" | "cancellationRequest" | "shipment">): number {
  const request = order.cancellationRequest ? (order.cancellationRequest.status === "PENDING" ? 1 : 2) : 0
  return STATUS_RANK[order.status] * 100 + request * 10 + (order.shipment ? 1 : 0)
}

function projection(order: ProcurementOrder) {
  const now = new Date()
  return {
    externalOrderId: order.id, partnerStatus: order.status, partnerVersion: procurementOrderRevision(order),
    // Gross includes the VAT-inclusive shipping fee (see procurementShippingKurus in presentation.ts).
    bindingNetKurus: order.totals.netKurus, bindingVatKurus: order.totals.vatKurus,
    bindingGrossKurus: order.totals.grossKurus, currency: order.currency,
    pricingPolicyVersion: order.contractVersion,
    // v2.0 reserves nothing; the column only carried the 1.0 reservation TTL.
    reservationExpiresAt: null, failureCode: null,
    cancellationRequestedAt: order.cancellationRequest ? new Date(order.cancellationRequest.requestedAt) : null,
    cancellationCode: procurementCancellationCode(order),
    failedAt: null, lastReconciledAt: now,
    nextReconcileAt: TERMINAL_PROCUREMENT_STATUSES.has(order.status) ? null : new Date(now.getTime() + RECONCILE_INTERVAL_MS),
    reconcileFailureCount: 0, lastReconcileError: null, manualReconcileRequiredAt: null,
  } satisfies Prisma.ExternalProcurementOrderUpdateManyMutationInput
}

/** Per-line binding prices, matched to the local items by offer id. */
export function itemProjections(order: ProcurementOrder) {
  return order.lines.map((line) => ({
    externalOfferId: line.selectedOfferId,
    data: {
      quantity: line.quantity, unitNetKurus: line.unitNetKurus,
      // Per-unit columns; the contract computes VAT per line, so these are rounded shares of it.
      unitVatKurus: Math.round(line.lineVatKurus / line.quantity),
      unitGrossKurus: Math.round(line.lineGrossKurus / line.quantity),
    },
  }))
}

/** Apply a provider projection once, atomically with its items, iff its revision is newer. */
export async function applyExternalProcurementProjection(
  tx: Prisma.TransactionClient,
  localId: string,
  order: ProcurementOrder,
) {
  const local = await tx.externalProcurementOrder.findUnique({
    where: { id: localId }, select: { externalOrderId: true, partnerVersion: true },
  })
  if (!local) return false
  if (local.externalOrderId && local.externalOrderId !== order.id) throw new Error("Provider order identity mismatch")
  const revision = procurementOrderRevision(order)
  if (local.externalOrderId && local.partnerVersion >= revision) return false

  const result = await tx.externalProcurementOrder.updateMany({
    where: {
      id: localId,
      ...(local.externalOrderId
        ? { externalOrderId: order.id, partnerVersion: { lt: revision } }
        : { externalOrderId: null, partnerVersion: { lte: revision } }),
    },
    data: projection(order),
  })
  if (result.count !== 1) return false
  for (const item of itemProjections(order)) {
    await tx.externalProcurementOrderItem.updateMany({
      where: { externalProcurementOrderId: localId, externalOfferId: item.externalOfferId }, data: item.data,
    })
  }
  return true
}

/**
 * Trusted application boundary. Callers must derive workshop/user identity from
 * requireWritableWorkshop("parts.purchase"), never from a request body.
 */
export async function startExternalProcurement(client: ProcurementProviderClient, input: StartProcurementInput) {
  if (input.quantity <= 0 || input.quantity > MAX_PROCUREMENT_LINE_QUANTITY || !Number.isInteger(input.quantity)) {
    throw new Error("Invalid procurement quantity")
  }
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

  let local = existing
  if (!local) try {
    local = await prisma.$transaction(async (tx) => {
      const item = await tx.serviceOrderItem.findFirst({
        where: {
          id: input.serviceOrderItemId, workshopId: input.workshopId,
          serviceOrderId: input.serviceOrderId,
          serviceOrder: { workshopId: input.workshopId },
        }, select: { id: true, partId: true },
      })
      if (!item) throw new Error("Service order item not found")
      if (item.partId !== null) throw new Error("External procurement cannot mutate or reserve local inventory")
      const itemOrder = await tx.externalProcurementOrderItem.findUnique({
        where: { serviceOrderItemId: input.serviceOrderItemId }, select: { id: true },
      })
      if (itemOrder) {
        throw new ProcurementProviderError("ALREADY_REQUESTED", "A procurement request already exists for this service order item.", false, 409)
      }
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
  } catch (error) {
    if ((error as { code?: string })?.code !== "P2002") throw error
    // Both the idempotency key and the item relation are unique. A concurrent
    // retry may have created the same attempt while this transaction ran.
    local = await prisma.externalProcurementOrder.findUnique({
      where: { provider_workshopId_idempotencyKey: {
        provider: client.provider, workshopId: input.workshopId, idempotencyKey: input.idempotencyKey,
      } }, include: { items: true },
    })
    if (!local || local.requestHash !== requestHash) {
      throw new ProcurementProviderError("ALREADY_REQUESTED", "A procurement request already exists for this service order item.", false, 409)
    }
    if (local.externalOrderId) return local
  }

  // One service order item = one line. v2.0 takes up to 20 lines per order;
  // the purchase dialog still buys one part at a time.
  const order = {
    idempotencyKey: input.idempotencyKey, confirmationToken: input.confirmationToken,
    lines: [{ selectedOfferId: input.externalOfferId, quantity: input.quantity, expectedUnitNetKurus: input.expectedUnitNetKurus }],
    shippingAddress: input.shippingAddress, note: input.note,
  }
  try {
    let result
    try {
      result = await client.createOrder(order)
    } catch (error) {
      if (!(error instanceof ProcurementProviderError) || !error.retryable) throw error
      // The same provider idempotency key safely reconciles an ambiguous first attempt.
      result = await client.createOrder(order)
    }
    return await prisma.$transaction(async (tx) => {
      await applyExternalProcurementProjection(tx, local.id, result.order)
      return tx.externalProcurementOrder.findUniqueOrThrow({ where: { id: local.id }, include: { items: true } })
    })
  } catch (error) {
    // A definite rejection created nothing: release the item for a new quote and
    // a new Idempotency-Key, as the contract asks after an order-creation 409.
    if (error instanceof ProcurementProviderError && (requiresProcurementReconfirmation(error.code) || releasesProcurementAttempt(error))) {
      await prisma.externalProcurementOrder.delete({ where: { id: local.id } })
      throw error
    }
    // The provider may have created an order before a timeout. Keep this local
    // attempt and its key so the next user retry can replay the remote result.
    if (error instanceof ProcurementProviderError && error.retryable) throw error
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
  const externalOrderId = local.externalOrderId
  try {
    const result = await client.cancelOrder(externalOrderId)
    await prisma.$transaction((tx) => applyExternalProcurementProjection(tx, local.id, result.order))
    return result
  } catch (error) {
    // Final answers for this order (request rejected, already shipped): pull the
    // current state so the work order stops offering a cancel that cannot work.
    if (error instanceof ProcurementProviderError && (error.code === "CANCELLATION_REJECTED" || error.code === "ORDER_ALREADY_SHIPPED")) {
      const remote = await client.getOrder(externalOrderId).catch(() => null)
      if (remote) await prisma.$transaction((tx) => applyExternalProcurementProjection(tx, local.id, remote))
    }
    throw error
  }
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
  database: typeof prisma = prisma,
) {
  const now = options.now ?? new Date()
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100)
  const rows = await database.externalProcurementOrder.findMany({
    where: {
      provider: client.provider,
      OR: [
        { externalOrderId: null, partnerStatus: "INITIATING" },
        { externalOrderId: { not: null }, partnerStatus: { in: PROCUREMENT_STATUSES.filter((status) => !TERMINAL_PROCUREMENT_STATUSES.has(status)) } },
      ],
      AND: [{ OR: [{ nextReconcileAt: null }, { nextReconcileAt: { lte: now } }] }],
    },
    orderBy: [{ nextReconcileAt: "asc" }, { updatedAt: "asc" }], take: limit,
    select: { id: true, idempotencyKey: true, createdAt: true, externalOrderId: true, partnerVersion: true, reconcileFailureCount: true },
  })
  let processed = 0
  let applied = 0
  let failed = 0
  for (const row of rows) {
    const leaseUntil = new Date(now.getTime() + RECONCILE_LEASE_MS)
    const claimed = await database.externalProcurementOrder.updateMany({
      where: {
        id: row.id, partnerVersion: row.partnerVersion,
        OR: [{ nextReconcileAt: null }, { nextReconcileAt: { lte: now } }],
      },
      data: { nextReconcileAt: leaseUntil },
    })
    if (claimed.count !== 1) continue
    processed += 1
    try {
      const remote = row.externalOrderId
        ? await client.getOrder(row.externalOrderId)
        : await client.getOrderByIdempotencyKey(row.idempotencyKey)
      if (!remote) {
        if (row.createdAt.getTime() <= now.getTime() - INITIATING_MAX_AGE_MS) {
          // An authoritative partner lookup still found no order well after the
          // request timeout. Release the local item for a fresh price approval.
          await database.externalProcurementOrder.deleteMany({
            where: { ...pollCompletionGuard(row, leaseUntil), partnerStatus: "INITIATING", externalOrderId: null },
          })
        } else {
          await database.externalProcurementOrder.updateMany({
            where: pollCompletionGuard(row, leaseUntil),
            data: { lastReconciledAt: now, nextReconcileAt: new Date(now.getTime() + RECONCILE_INTERVAL_MS), reconcileFailureCount: 0, lastReconcileError: null },
          })
        }
        continue
      }
      if (await database.$transaction((tx) => applyExternalProcurementProjection(tx, row.id, remote))) applied += 1
      else await database.externalProcurementOrder.updateMany({
        where: pollCompletionGuard(row, leaseUntil),
        data: { lastReconciledAt: now, nextReconcileAt: TERMINAL_PROCUREMENT_STATUSES.has(remote.status) ? null : new Date(now.getTime() + RECONCILE_INTERVAL_MS), reconcileFailureCount: 0, lastReconcileError: null, manualReconcileRequiredAt: null },
      })
    } catch (error) {
      failed += 1
      const nextFailureCount = row.reconcileFailureCount + 1
      const code = error instanceof ProcurementProviderError ? error.code : "RECONCILE_FAILED"
      await database.externalProcurementOrder.updateMany({
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

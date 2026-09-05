import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { addPeriod, periodStartFrom } from "@/lib/billing/period"
import { createCommissionDraftForBillingOrderTx } from "@/lib/sales/commission"
import { getSeatLimit } from "@/lib/plan"
import { selectSeatAdjustment } from "@/lib/billing/seat-adjustment"

export type SeatAdjustmentResult = {
  limit: number
  deactivatedUsers: number
  deactivatedTechnicians: number
  revokedInvites: number
}
type Result = { ok: true; seatAdjustment: SeatAdjustmentResult } | { ok: false; error: string }

export type ActivateBillingOrderOpts = {
  /** Who triggered the confirmation — recorded in the audit metadata so admin
   *  manual-confirms and automated payment callbacks stay distinguishable. */
  actor: "admin" | "payment"
  /** Stored on BillingOrder.confirmedByEmail — admin's email for manual
   *  confirms, a fixed provider label (e.g. "tami") for payment callbacks. */
  confirmedByEmail: string
  /** Admin user id for the audit log actor. Absent for the payment path —
   *  AuditLogAction accepts an undefined actor (see calendar/sync.ts). */
  actorUserId?: string | null
}

/** Confirm a pending havale/payment: activate the plan + set the paid period.
 *  Doubles as approval for public direct-purchase workshops. Shared by the
 *  admin manual-confirm action and the TAMI payment callback — both actors
 *  run the exact same transactional claim-guard + workshop update. */
export async function activateBillingOrder(
  orderId: string,
  opts: ActivateBillingOrderOpts
): Promise<Result> {
  if (!orderId) return { ok: false, error: "Sipariş seçilmedi." }

  const order = await prisma.billingOrder.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, error: "Sipariş bulunamadı." }
  if (order.status !== "pending_payment") return { ok: false, error: "Bu sipariş zaten işlenmiş." }

  const workshop = await prisma.workshop.findUnique({
    where: { id: order.workshopId },
    select: { currentPeriodEnd: true, planTier: true, extraSeats: true },
  })
  const now = new Date()
  // Renewal extends from the current period end (no lost days); package changes
  // and new purchases start a fresh period now (changes were proration-credited).
  const periodStart =
    order.type === "renewal" ? periodStartFrom(workshop?.currentPeriodEnd ?? null, now) : now
  const periodEnd = addPeriod(periodStart, order.billingCycle)

  let seatAdjustment: SeatAdjustmentResult = {
    limit: getSeatLimit(order.planTier, workshop?.extraSeats ?? 0),
    deactivatedUsers: 0,
    deactivatedTechnicians: 0,
    revokedInvites: 0,
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Workshop" WHERE id = ${order.workshopId} FOR UPDATE`
      const claimed = await tx.billingOrder.updateMany({
        where: { id: order.id, status: "pending_payment" },
        data: {
          status: "confirmed",
          confirmedAt: now,
          confirmedByEmail: opts.confirmedByEmail,
          periodStart,
          periodEnd,
        },
      })
      if (claimed.count === 0) {
        // Another confirm already processed this order — abort the whole tx.
        throw new Error("ALREADY_PROCESSED")
      }
      const nowForSeats = new Date()
      const [activeUsers, pendingInvites] = await Promise.all([
        tx.user.findMany({
          where: { workshopId: order.workshopId, isActive: true },
          select: { id: true, role: true, createdAt: true, technicianId: true },
        }),
        tx.invite.findMany({
          where: {
            workshopId: order.workshopId,
            status: "pending",
            expiresAt: { gt: nowForSeats },
          },
          select: { id: true, createdAt: true },
        }),
      ])
      const selection = selectSeatAdjustment(activeUsers, pendingInvites, seatAdjustment.limit)
      if (selection.deactivatedUserIds.length > 0) {
        await tx.user.updateMany({
          where: { id: { in: selection.deactivatedUserIds }, workshopId: order.workshopId },
          data: { isActive: false },
        })
      }
      if (selection.revokedInviteIds.length > 0) {
        await tx.invite.updateMany({
          where: { id: { in: selection.revokedInviteIds }, workshopId: order.workshopId },
          data: { status: "revoked" },
        })
      }
      let deactivatedTechnicians = 0
      if (selection.technicianIdsToReview.length > 0) {
        const technicianUpdate = await tx.technician.updateMany({
          where: {
            id: { in: selection.technicianIdsToReview },
            workshopId: order.workshopId,
            linkedUsers: { none: { isActive: true } },
          },
          data: { isActive: false },
        })
        deactivatedTechnicians = technicianUpdate.count
      }
      seatAdjustment = {
        ...seatAdjustment,
        deactivatedUsers: selection.deactivatedUserIds.length,
        deactivatedTechnicians,
        revokedInvites: selection.revokedInviteIds.length,
      }
      await tx.workshop.update({
        where: { id: order.workshopId },
        data: {
          planTier: order.planTier,
          billingCycle: order.billingCycle,
          subscriptionStatus: "active",
          approvalStatus: "approved",
          currentPeriodEnd: periodEnd,
          requestedPlanTier: null,
          planRequestedAt: null,
        },
      })
      await createCommissionDraftForBillingOrderTx(
        tx,
        order,
        workshop?.planTier ?? null,
        { userId: opts.actorUserId, label: opts.confirmedByEmail },
      )
    })
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_PROCESSED") {
      return { ok: false, error: "Bu sipariş zaten işlenmiş." }
    }
    console.error("[activateBillingOrder] failed:", err instanceof Error ? err.message : err)
    return { ok: false, error: "İşlem başarısız. Lütfen tekrar deneyin." }
  }

  await AuditLogAction(
    order.workshopId,
    opts.actorUserId ?? undefined,
    "BillingOrder",
    order.id,
    "billing_order_confirmed",
    JSON.stringify({
      tier: order.planTier,
      cycle: order.billingCycle,
      amountMinor: order.amountMinor,
      actor: opts.actor,
      seatAdjustment,
    })
  )
  if (
    seatAdjustment.deactivatedUsers > 0 ||
    seatAdjustment.deactivatedTechnicians > 0 ||
    seatAdjustment.revokedInvites > 0
  ) {
    await AuditLogAction(
      order.workshopId,
      opts.actorUserId ?? undefined,
      "Workshop",
      order.workshopId,
      "plan_seat_limit_applied",
      JSON.stringify({ tier: order.planTier, ...seatAdjustment }),
    )
  }
  return { ok: true, seatAdjustment }
}

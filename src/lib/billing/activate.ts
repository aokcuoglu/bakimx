import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { addPeriod, periodStartFrom } from "@/lib/billing/period"

type Result = { ok: true } | { ok: false; error: string }

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
    select: { currentPeriodEnd: true },
  })
  const now = new Date()
  // Renewal extends from the current period end (no lost days); upgrade /
  // new_purchase start a fresh period now (upgrades were proration-credited).
  const periodStart =
    order.type === "renewal" ? periodStartFrom(workshop?.currentPeriodEnd ?? null, now) : now
  const periodEnd = addPeriod(periodStart, order.billingCycle)

  try {
    await prisma.$transaction(async (tx) => {
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
    })
  )
  return { ok: true }
}

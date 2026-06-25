"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { computeTrialEnd, type PlanTier } from "@/lib/plan"
import { addPeriod, periodStartFrom } from "@/lib/billing/period"
import type { DemoRequestStatus, SupportRequestStatus } from "@prisma/client"
import { workshopApprovedEmail, workshopRejectedEmail } from "@/lib/emails/system-emails"
import { sendSystemEmail } from "@/lib/emails/send-system-email"

type Result = { ok: true } | { ok: false; error: string }

/** İş yeri sahibine onay/red bildirimi gönderir. Best-effort — hata aksiyonu bozmaz.
 *  Alıcı: owner User'ın e-postası (yoksa workshop.email fallback). Tenant izolasyonu:
 *  sorgu workshopId ile sınırlı. */
async function sendOwnerDecisionEmail(
  workshopId: string,
  workshopName: string,
  fallbackEmail: string | null,
  decision: "approved" | "rejected",
): Promise<void> {
  try {
    const owner = await prisma.user.findFirst({
      where: { workshopId, role: "owner" },
      select: { email: true, firstName: true },
      orderBy: { createdAt: "asc" },
    })
    const to = owner?.email || fallbackEmail
    if (!to) return

    const built =
      decision === "approved"
        ? workshopApprovedEmail({ firstName: owner?.firstName || "", workshopName })
        : workshopRejectedEmail({ firstName: owner?.firstName || "", workshopName })

    await sendSystemEmail({
      to,
      subject: built.subject,
      html: built.html,
      workshopId,
      templateKey: decision === "approved" ? "workshop_approved" : "workshop_rejected",
    })
  } catch (err) {
    console.error("[admin] decision email failed:", err instanceof Error ? err.message : err)
  }
}

const TIERS: PlanTier[] = ["starter", "pro", "premium"]
const STATUSES = ["trialing", "active", "past_due", "canceled"] as const
type SubStatus = (typeof STATUSES)[number]

const DEMO_STATUSES: DemoRequestStatus[] = ["new", "contacted", "qualified", "converted", "archived"]
const SUPPORT_STATUSES: SupportRequestStatus[] = ["new", "in_progress", "resolved", "archived"]

/** Approve a pending workshop and start its 15-day trial. */
export async function approveWorkshop(workshopId: string): Promise<Result> {
  const admin = await requireAdmin()
  if (!workshopId) return { ok: false, error: "İş yeri seçilmedi." }

  const now = new Date()
  const ws = await prisma.workshop.update({
    where: { id: workshopId },
    data: {
      approvalStatus: "approved",
      subscriptionStatus: "trialing",
      trialStartedAt: now,
      trialEndsAt: computeTrialEnd(now),
    },
  })
  await AuditLogAction(workshopId, admin.id, "Workshop", workshopId, "admin_workshop_approved")
  await sendOwnerDecisionEmail(workshopId, ws.name, ws.email, "approved")
  revalidatePath("/admin")
  return { ok: true }
}

/** Reject a workshop (blocks sign-in). */
export async function rejectWorkshop(workshopId: string): Promise<Result> {
  const admin = await requireAdmin()
  if (!workshopId) return { ok: false, error: "İş yeri seçilmedi." }

  const ws = await prisma.workshop.update({
    where: { id: workshopId },
    data: { approvalStatus: "rejected" },
  })
  await AuditLogAction(workshopId, admin.id, "Workshop", workshopId, "admin_workshop_rejected")
  await sendOwnerDecisionEmail(workshopId, ws.name, ws.email, "rejected")
  revalidatePath("/admin")
  return { ok: true }
}

/** Activate a paid plan (fulfils any pending upgrade request). */
export async function activateWorkshopPlan(
  workshopId: string,
  tier: string,
  status: string = "active"
): Promise<Result> {
  const admin = await requireAdmin()
  if (!workshopId) return { ok: false, error: "İş yeri seçilmedi." }
  if (!TIERS.includes(tier as PlanTier)) return { ok: false, error: "Geçersiz paket." }
  if (!STATUSES.includes(status as SubStatus)) return { ok: false, error: "Geçersiz durum." }

  await prisma.workshop.update({
    where: { id: workshopId },
    data: {
      planTier: tier as PlanTier,
      subscriptionStatus: status as SubStatus,
      approvalStatus: "approved",
      requestedPlanTier: null,
      planRequestedAt: null,
    },
  })
  await AuditLogAction(
    workshopId,
    admin.id,
    "Workshop",
    workshopId,
    "admin_plan_activated",
    JSON.stringify({ tier, status })
  )
  revalidatePath("/admin")
  return { ok: true }
}

/** Grant/adjust founder-provided extra login seats (paid overage / custom deal). */
export async function setWorkshopExtraSeats(workshopId: string, extraSeats: number): Promise<Result> {
  const admin = await requireAdmin()
  if (!workshopId) return { ok: false, error: "İş yeri seçilmedi." }
  if (!Number.isInteger(extraSeats) || extraSeats < 0 || extraSeats > 500) {
    return { ok: false, error: "Geçersiz ek koltuk sayısı." }
  }

  await prisma.workshop.update({ where: { id: workshopId }, data: { extraSeats } })
  await AuditLogAction(
    workshopId,
    admin.id,
    "Workshop",
    workshopId,
    "admin_extra_seats_set",
    JSON.stringify({ extraSeats })
  )
  revalidatePath("/admin")
  return { ok: true }
}

/** Update the workflow status of a public demo request lead.
 *  No AuditLog — DemoRequest is not workshop-scoped; its `status`/`updatedAt`
 *  fields already track changes. AuditLog is workshop-bound and inappropriate
 *  for public leads. */
export async function updateDemoRequestStatus(
  requestId: string,
  status: string
): Promise<Result> {
  await requireAdmin()
  if (!requestId) return { ok: false, error: "Talep seçilmedi." }
  if (!DEMO_STATUSES.includes(status as DemoRequestStatus)) {
    return { ok: false, error: "Geçersiz durum." }
  }

  await prisma.demoRequest.update({
    where: { id: requestId },
    data: { status: status as DemoRequestStatus },
  })
  revalidatePath("/admin")
  return { ok: true }
}

/** Update the workflow status of a public support request.
 *  No AuditLog — SupportRequest is not workshop-scoped; its `status`/`updatedAt`
 *  fields already track changes. AuditLog is workshop-bound and inappropriate
 *  for public leads. */
export async function updateSupportRequestStatus(
  requestId: string,
  status: string
): Promise<Result> {
  await requireAdmin()
  if (!requestId) return { ok: false, error: "Talep seçilmedi." }
  if (!SUPPORT_STATUSES.includes(status as SupportRequestStatus)) {
    return { ok: false, error: "Geçersiz durum." }
  }

  await prisma.supportRequest.update({
    where: { id: requestId },
    data: { status: status as SupportRequestStatus },
  })
  revalidatePath("/admin")
  return { ok: true }
}

/** Confirm a pending havale: activate the plan + set the paid period. Doubles
 *  as approval for public direct-purchase workshops. */
export async function confirmBillingOrder(orderId: string): Promise<Result> {
  const admin = await requireAdmin()
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
          confirmedByEmail: admin.email,
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
    console.error("[confirmBillingOrder] failed:", err instanceof Error ? err.message : err)
    return { ok: false, error: "İşlem başarısız. Lütfen tekrar deneyin." }
  }

  await AuditLogAction(order.workshopId, admin.id, "BillingOrder", order.id, "billing_order_confirmed",
    JSON.stringify({ tier: order.planTier, cycle: order.billingCycle, amountMinor: order.amountMinor }))
  revalidatePath("/admin")
  return { ok: true }
}

/** Cancel a pending order (e.g. havale never arrived). */
export async function cancelBillingOrder(orderId: string): Promise<Result> {
  const admin = await requireAdmin()
  if (!orderId) return { ok: false, error: "Sipariş seçilmedi." }
  const order = await prisma.billingOrder.findUnique({ where: { id: orderId }, select: { id: true, status: true, workshopId: true } })
  if (!order) return { ok: false, error: "Sipariş bulunamadı." }
  if (order.status !== "pending_payment") return { ok: false, error: "Yalnızca bekleyen sipariş iptal edilebilir." }

  const cancelled = await prisma.billingOrder.updateMany({
    where: { id: orderId, status: "pending_payment" },
    data: { status: "cancelled" },
  })
  if (cancelled.count === 0) return { ok: false, error: "Yalnızca bekleyen sipariş iptal edilebilir." }
  await AuditLogAction(order.workshopId, admin.id, "BillingOrder", orderId, "billing_order_cancelled")
  revalidatePath("/admin")
  return { ok: true }
}

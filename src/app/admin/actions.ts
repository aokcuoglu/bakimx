"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin, requireAdminCapability } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { isGatedFeature } from "@/lib/features"
import { computeTrialEnd, type PlanTier } from "@/lib/plan"
import { activateBillingOrder } from "@/lib/billing/activate"
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

/** Approve a workshop and (re)start its 7-day trial. Legacy path: self
 *  sign-ups are approved instantly now, so this is only reached for old
 *  `pending` rows or to un-reject a previously rejected workshop. */
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
  revalidatePath("/admin", "layout")
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
  revalidatePath("/admin", "layout")
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
  revalidatePath("/admin", "layout")
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
  revalidatePath("/admin", "layout")
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
  revalidatePath("/admin", "layout")
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
  revalidatePath("/admin", "layout")
  return { ok: true }
}

/** Confirm a pending havale: activate the plan + set the paid period. Doubles
 *  as approval for public direct-purchase workshops. Thin wrapper — the
 *  actual claim-guard transaction lives in activateBillingOrder so the TAMI
 *  payment callback can share it. */
export async function confirmBillingOrder(orderId: string): Promise<Result> {
  const admin = await requireAdmin()
  const result = await activateBillingOrder(orderId, {
    actor: "admin",
    confirmedByEmail: admin.email,
    actorUserId: admin.id,
  })
  if (!result.ok) return result
  revalidatePath("/admin", "layout")
  return { ok: true }
}

/** Recover a card payment stuck at `callback_received` (bank captured the
 *  charge but activation never completed — see sweepStalePaymentArtifacts'
 *  founder alert). Reuses the exact same claim-guard transaction as the
 *  automated callback and the manual havale confirm, so this can never
 *  double-activate an already-confirmed order. */
export async function retryStuckActivation(transactionId: string): Promise<Result> {
  const admin = await requireAdmin()
  if (!transactionId) return { ok: false, error: "İşlem seçilmedi." }

  const txn = await prisma.paymentTransaction.findUnique({ where: { id: transactionId } })
  if (!txn) return { ok: false, error: "İşlem bulunamadı." }
  if (txn.status !== "callback_received") {
    return { ok: false, error: "Bu işlem kurtarma için uygun durumda değil." }
  }

  const activation = await activateBillingOrder(txn.billingOrderId, {
    actor: "admin",
    confirmedByEmail: admin.email,
    actorUserId: admin.id,
  })

  if (activation.ok) {
    const claimed = await prisma.paymentTransaction.updateMany({
      where: { id: transactionId, status: "callback_received" },
      data: { status: "completed", completedAt: new Date() },
    })
    if (claimed.count > 0) {
      await AuditLogAction(
        txn.workshopId,
        admin.id,
        "PaymentTransaction",
        transactionId,
        "payment_activation_retried",
        JSON.stringify({ billingOrderId: txn.billingOrderId, result: "activated" })
      )
    }
    revalidatePath("/admin", "layout")
    return { ok: true }
  }

  // "Bu sipariş zaten işlenmiş." → order was confirmed by another path (the
  // callback route racing this admin action, or an earlier retry). The bank
  // already captured the money either way, so close the loop on the txn row
  // too — but the audit trail records the different reason.
  if (activation.error === "Bu sipariş zaten işlenmiş.") {
    const claimed = await prisma.paymentTransaction.updateMany({
      where: { id: transactionId, status: "callback_received" },
      data: { status: "completed", completedAt: new Date() },
    })
    if (claimed.count > 0) {
      await AuditLogAction(
        txn.workshopId,
        admin.id,
        "PaymentTransaction",
        transactionId,
        "payment_activation_retried",
        JSON.stringify({ billingOrderId: txn.billingOrderId, result: "already_confirmed" })
      )
    }
    revalidatePath("/admin", "layout")
    return { ok: true }
  }

  // Any other failure (order missing, DB error): leave the txn untouched so
  // it stays visible in the stuck-transactions list for another attempt.
  return activation
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
  revalidatePath("/admin", "layout")
  return { ok: true }
}

/** Set (upsert) a per-tenant feature override. `enabled` forces the feature on/off
 *  for this workshop regardless of plan tier (resolveFeature composes with this).
 *  Optional ISO `expiresAt` auto-expires the grant (e.g. time-boxed beta). */
export async function setWorkshopFeatureOverride(
  workshopId: string,
  featureKey: string,
  enabled: boolean,
  expiresAtIso?: string | null,
): Promise<Result> {
  const ctx = await requireAdminCapability("manageFlags")
  if (!workshopId) return { ok: false, error: "İş yeri seçilmedi." }
  if (!isGatedFeature(featureKey)) return { ok: false, error: "Geçersiz özellik." }

  let expiresAt: Date | null = null
  if (expiresAtIso) {
    const d = new Date(expiresAtIso)
    if (Number.isNaN(d.getTime())) return { ok: false, error: "Geçersiz bitiş tarihi." }
    expiresAt = d
  }

  await prisma.workshopFeatureOverride.upsert({
    where: { workshopId_featureKey: { workshopId, featureKey } },
    create: { workshopId, featureKey, enabled, expiresAt, createdBy: ctx.user.id },
    update: { enabled, expiresAt, createdBy: ctx.user.id },
  })
  await AuditLogAction(
    workshopId,
    ctx.user.id,
    "WorkshopFeatureOverride",
    featureKey,
    "feature_override_set",
    JSON.stringify({ featureKey, enabled, expiresAt: expiresAt?.toISOString() ?? null }),
  )
  revalidatePath("/admin", "layout")
  return { ok: true }
}

/** Remove a per-tenant override → the feature falls back to the plan tier. */
export async function clearWorkshopFeatureOverride(
  workshopId: string,
  featureKey: string,
): Promise<Result> {
  const ctx = await requireAdminCapability("manageFlags")
  if (!workshopId) return { ok: false, error: "İş yeri seçilmedi." }
  if (!isGatedFeature(featureKey)) return { ok: false, error: "Geçersiz özellik." }

  await prisma.workshopFeatureOverride.deleteMany({ where: { workshopId, featureKey } })
  await AuditLogAction(
    workshopId,
    ctx.user.id,
    "WorkshopFeatureOverride",
    featureKey,
    "feature_override_cleared",
    JSON.stringify({ featureKey }),
  )
  revalidatePath("/admin", "layout")
  return { ok: true }
}

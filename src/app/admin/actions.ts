"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { computeTrialEnd, type PlanTier } from "@/lib/plan"

type Result = { ok: true } | { ok: false; error: string }

const TIERS: PlanTier[] = ["starter", "pro", "premium"]
const STATUSES = ["trialing", "active", "past_due", "canceled"] as const
type SubStatus = (typeof STATUSES)[number]

/** Approve a pending workshop and start its 15-day trial. */
export async function approveWorkshop(workshopId: string): Promise<Result> {
  const admin = await requireAdmin()
  if (!workshopId) return { ok: false, error: "İş yeri seçilmedi." }

  const now = new Date()
  await prisma.workshop.update({
    where: { id: workshopId },
    data: {
      approvalStatus: "approved",
      subscriptionStatus: "trialing",
      trialStartedAt: now,
      trialEndsAt: computeTrialEnd(now),
    },
  })
  await AuditLogAction(workshopId, admin.id, "Workshop", workshopId, "admin_workshop_approved")
  revalidatePath("/admin")
  return { ok: true }
}

/** Reject a workshop (blocks sign-in). */
export async function rejectWorkshop(workshopId: string): Promise<Result> {
  const admin = await requireAdmin()
  if (!workshopId) return { ok: false, error: "İş yeri seçilmedi." }

  await prisma.workshop.update({
    where: { id: workshopId },
    data: { approvalStatus: "rejected" },
  })
  await AuditLogAction(workshopId, admin.id, "Workshop", workshopId, "admin_workshop_rejected")
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

"use server"

import { redirect } from "next/navigation"
import { requireAdminCapability } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { AuditLogAction } from "@/lib/audit"

type Result = { ok: true } | { ok: false; error: string }

// Hard cap on an impersonation session. Checked without a DB hit on every
// getCurrentUser() (epoch compare in the overlay).
const IMPERSONATION_TTL_MS = 30 * 60 * 1000 // 30 min

/**
 * Begin a READ-ONLY founder impersonation of a workshop's owner. Writes an
 * ImpersonationSession row (no silent path), sets the session overlay, audits,
 * and redirects into the app as the target tenant. Tenant-data writes are
 * blocked globally by the Prisma read-only guard.
 */
export async function startImpersonation(workshopId: string, reason?: string): Promise<Result> {
  const ctx = await requireAdminCapability("impersonate")
  if (!workshopId) return { ok: false, error: "İş yeri seçilmedi." }

  // Prefer the owner; fall back to the earliest active user.
  const owner = await prisma.user.findFirst({
    where: { workshopId, role: "owner", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  const target =
    owner ??
    (await prisma.user.findFirst({
      where: { workshopId, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }))
  if (!target) return { ok: false, error: "Bu iş yerinde aktif kullanıcı yok." }

  const expiresAt = new Date(Date.now() + IMPERSONATION_TTL_MS)
  const imp = await prisma.impersonationSession.create({
    data: {
      adminUserId: ctx.user.id,
      targetUserId: target.id,
      targetWorkshopId: workshopId,
      reason: reason?.trim() || null,
      readOnly: true,
      expiresAt,
    },
    select: { id: true },
  })

  const session = await getSession()
  session.impersonation = {
    adminUserId: ctx.user.id,
    targetUserId: target.id,
    targetWorkshopId: workshopId,
    sessionId: imp.id,
    expiresAt: expiresAt.getTime(),
    readOnly: true,
  }
  await session.save()

  await AuditLogAction(
    workshopId,
    ctx.user.id,
    "ImpersonationSession",
    imp.id,
    "impersonation_started",
    JSON.stringify({ targetUserId: target.id, expiresAt: expiresAt.toISOString(), readOnly: true }),
  )

  redirect("/dashboard")
}

/**
 * End the current impersonation: close the row, audit, clear the overlay, and
 * return the founder to /admin. Safe to call when no overlay is present.
 */
export async function stopImpersonation(): Promise<void> {
  const session = await getSession()
  const imp = session.impersonation
  if (imp) {
    // ImpersonationSession + AuditLog are exempt from the read-only write-guard.
    await prisma.impersonationSession.updateMany({
      where: { id: imp.sessionId, endedAt: null },
      data: { endedAt: new Date() },
    })
    await AuditLogAction(
      imp.targetWorkshopId,
      imp.adminUserId,
      "ImpersonationSession",
      imp.sessionId,
      "impersonation_ended",
    )
    delete session.impersonation
    await session.save()
  }
  redirect("/admin")
}

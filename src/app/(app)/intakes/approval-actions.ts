"use server"

// Customer approval moved to the delivery stage (see delivery-actions.ts). The
// former intake-time OTP flow (requestApprovalAction / verifyOtpAction) was
// removed; this module now only mints the read-only customer share link.

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"
import { AuditLogAction } from "@/lib/audit"

export async function generateShareLinkAction(intakeFormId: string) {
  const user = await requireAuth()

  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: intakeFormId, workshopId: user.workshopId },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }

  const existing = await prisma.publicShareLink.findFirst({
    where: { intakeFormId, workshopId: user.workshopId, isActive: true },
  })
  if (existing) {
    return { success: true, token: existing.token }
  }

  const token = nanoid(32)

  const shareLink = await prisma.publicShareLink.create({
    data: {
      workshopId: user.workshopId,
      intakeFormId,
      token,
    },
  })

  await AuditLogAction(user.workshopId, user.id, "PublicShareLink", shareLink.id, "share_link_generated")

  revalidatePath(`/intakes/${intakeFormId}`)
  return { success: true, token }
}
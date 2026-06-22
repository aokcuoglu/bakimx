"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"
import { AuditLogAction } from "@/lib/audit"
import { addTimelineEvent } from "@/lib/intake/timeline"
import { notifyIntakeApproval } from "@/lib/communications/triggers"

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function requestApprovalAction(intakeFormId: string) {
  const user = await requireAuth()

  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: intakeFormId, workshopId: user.workshopId },
    include: { customer: true, vehicle: true },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }

  const otpCode = generateOtp()

  const customerName =
    intake.customer.type === "corporate"
      ? intake.customer.companyName || "Kurumsal Müşteri"
      : intake.customer.fullName || `${intake.customer.firstName ?? ""} ${intake.customer.lastName ?? ""}`.trim() || "Müşteri"
  const approvalTextVersion = `Araç Kabul Formu\n\nMüşteri: ${customerName}\nPlaka: ${intake.vehicle.plate}\nŞikayet: ${intake.customerComplaint}\n\nOnaylıyorum.`

  const approval = await prisma.$transaction(async (tx) => {
    const created = await tx.approvalRequest.create({
      data: {
        workshopId: user.workshopId,
        intakeFormId,
        phone: intake.customer.phone,
        otpCode,
        approvalTextVersion,
        status: "pending",
      },
    })

    await tx.vehicleIntakeForm.updateMany({
      where: { id: intakeFormId, workshopId: user.workshopId },
      data: { status: "waiting_approval", approvalTextVersion },
    })

    return created
  })

  await AuditLogAction(user.workshopId, user.id, "ApprovalRequest", approval.id, "approval_requested")

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId,
    eventType: "approval_requested",
    description: "Müşteri onayı istendi",
  })

  try {
    await notifyIntakeApproval(
      user.workshopId,
      intake.customerId,
      intake.vehicle?.plate || null,
      `approval-${approval.id}`,
      intakeFormId,
    )
  } catch (e) {
    console.error("[notifyIntakeApproval] Onay bildirimi gönderilemedi:", e)
  }

  revalidatePath(`/app/intakes/${intakeFormId}`)
  return {
    success: true as const,
    otpCode: process.env.NODE_ENV !== "production" ? otpCode : undefined,
    approvalId: approval.id,
  }
}

export async function verifyOtpAction(intakeFormId: string, otpCode: string) {
  const user = await requireAuth()

  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: intakeFormId, workshopId: user.workshopId },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }

  const approval = await prisma.approvalRequest.findFirst({
    where: { intakeFormId, workshopId: user.workshopId, status: "pending" },
    orderBy: { createdAt: "desc" },
  })
  if (!approval) return { error: "Bekleyen onay talebi bulunamadı" }
  if (approval.status !== "pending") return { error: "Bu talep zaten işlenmiş" }

  if (approval.otpCode !== otpCode) {
    return { error: "Geçersiz doğrulama kodu" }
  }

  await prisma.$transaction(async (tx) => {
    await tx.approvalRequest.updateMany({
      where: { id: approval.id, workshopId: user.workshopId },
      data: {
        status: "verified",
        approvedAt: new Date(),
      },
    })

    await tx.vehicleIntakeForm.updateMany({
      where: { id: intakeFormId, workshopId: user.workshopId },
      data: { status: "approved", approvedAt: new Date() },
    })
  })

  await AuditLogAction(user.workshopId, user.id, "ApprovalRequest", approval.id, "approval_verified")

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId,
    eventType: "approval_verified",
    description: "Müşteri onayı doğrulandı",
  })

  revalidatePath(`/app/intakes/${intakeFormId}`)
  return { success: true }
}

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

  revalidatePath(`/app/intakes/${intakeFormId}`)
  return { success: true, token }
}
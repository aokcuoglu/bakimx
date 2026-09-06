"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { getSalesAccess } from "@/lib/sales/access"
import {
  canTransitionSalesCommission,
  commissionApprovalError,
} from "@/lib/sales/commission"
import {
  salesCommissionApprovalSchema,
  salesCommissionVoidSchema,
} from "@/lib/validations/sales"

type Result = { ok: true } | { ok: false; error: string }

class CommissionWorkflowError extends Error {}

function refreshCommissions() {
  revalidatePath("/admin/sales/commissions")
  revalidatePath("/admin/sales")
}

async function actorLabel(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true },
  })
  return [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Yetkili yönetici"
}

export async function approveSalesCommission(id: string, input: unknown): Promise<Result> {
  const access = await getSalesAccess("manageSalesCommissions")
  const parsed = salesCommissionApprovalSchema.safeParse(input)
  if (!id) return { ok: false, error: "Hakediş seçilmedi." }
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz hakediş" }
  const actor = await actorLabel(access.userId)
  const now = new Date()

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.salesCommission.findUnique({
        where: { id },
        select: { status: true, calculatedAmountMinor: true },
      })
      if (!current) throw new CommissionWorkflowError("Hakediş bulunamadı.")
      if (!canTransitionSalesCommission(current.status, "approved")) {
        throw new CommissionWorkflowError("Yalnız taslak hakediş onaylanabilir.")
      }

      const adjustmentError = commissionApprovalError({
        calculatedAmountMinor: current.calculatedAmountMinor,
        approvedAmountMinor: parsed.data.approvedAmountMinor,
        adjustmentReason: parsed.data.adjustmentReason,
      })
      if (adjustmentError) throw new CommissionWorkflowError(adjustmentError)
      const isAdjustment =
        current.calculatedAmountMinor == null ||
        current.calculatedAmountMinor !== parsed.data.approvedAmountMinor
      const reason = isAdjustment
        ? parsed.data.adjustmentReason.trim()
        : "Hesaplanan hakediş tutarı onaylandı."

      const updated = await tx.salesCommission.updateMany({
        where: { id, status: "draft" },
        data: {
          status: "approved",
          approvedAmountMinor: parsed.data.approvedAmountMinor,
          adjustmentReason: isAdjustment ? reason : null,
          note: parsed.data.note || null,
          approvedAt: now,
        },
      })
      if (updated.count !== 1) throw new CommissionWorkflowError("Hakediş başka bir işlem tarafından güncellendi.")
      await tx.salesCommissionEvent.create({
        data: {
          commissionId: id,
          fromStatus: "draft",
          toStatus: "approved",
          actorId: access.userId,
          actorLabel: actor,
          amountMinor: parsed.data.approvedAmountMinor,
          reason,
          createdAt: now,
        },
      })
    })
  } catch (error) {
    if (error instanceof CommissionWorkflowError) return { ok: false, error: error.message }
    throw error
  }

  refreshCommissions()
  return { ok: true }
}

export async function markSalesCommissionPaid(id: string): Promise<Result> {
  const access = await getSalesAccess("manageSalesCommissions")
  if (!id) return { ok: false, error: "Hakediş seçilmedi." }
  const actor = await actorLabel(access.userId)
  const now = new Date()

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.salesCommission.findUnique({
        where: { id },
        select: { status: true, approvedAmountMinor: true },
      })
      if (!current) throw new CommissionWorkflowError("Hakediş bulunamadı.")
      if (!canTransitionSalesCommission(current.status, "paid")) {
        throw new CommissionWorkflowError("Yalnız onaylı hakediş ödendi olarak işaretlenebilir.")
      }
      if (current.approvedAmountMinor == null) {
        throw new CommissionWorkflowError("Onaylanmış hakediş tutarı bulunamadı.")
      }
      const updated = await tx.salesCommission.updateMany({
        where: { id, status: "approved" },
        data: { status: "paid", paidAt: now },
      })
      if (updated.count !== 1) throw new CommissionWorkflowError("Hakediş başka bir işlem tarafından güncellendi.")
      await tx.salesCommissionEvent.create({
        data: {
          commissionId: id,
          fromStatus: "approved",
          toStatus: "paid",
          actorId: access.userId,
          actorLabel: actor,
          amountMinor: current.approvedAmountMinor,
          reason: "Hakediş ödendi olarak işaretlendi.",
          createdAt: now,
        },
      })
    })
  } catch (error) {
    if (error instanceof CommissionWorkflowError) return { ok: false, error: error.message }
    throw error
  }

  refreshCommissions()
  return { ok: true }
}

export async function voidSalesCommission(id: string, input: unknown): Promise<Result> {
  const access = await getSalesAccess("manageSalesCommissions")
  const parsed = salesCommissionVoidSchema.safeParse(input)
  if (!id) return { ok: false, error: "Hakediş seçilmedi." }
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "İptal gerekçesi zorunludur." }
  const actor = await actorLabel(access.userId)
  const now = new Date()

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.salesCommission.findUnique({
        where: { id },
        select: { status: true, approvedAmountMinor: true, calculatedAmountMinor: true },
      })
      if (!current) throw new CommissionWorkflowError("Hakediş bulunamadı.")
      if (!canTransitionSalesCommission(current.status, "void")) {
        throw new CommissionWorkflowError("Ödenmiş veya iptal edilmiş hakediş yeniden değiştirilemez.")
      }
      const updated = await tx.salesCommission.updateMany({
        where: { id, status: current.status },
        data: { status: "void", voidedAt: now },
      })
      if (updated.count !== 1) throw new CommissionWorkflowError("Hakediş başka bir işlem tarafından güncellendi.")
      await tx.salesCommissionEvent.create({
        data: {
          commissionId: id,
          fromStatus: current.status,
          toStatus: "void",
          actorId: access.userId,
          actorLabel: actor,
          amountMinor: current.approvedAmountMinor ?? current.calculatedAmountMinor,
          reason: parsed.data.reason,
          createdAt: now,
        },
      })
    })
  } catch (error) {
    if (error instanceof CommissionWorkflowError) return { ok: false, error: error.message }
    throw error
  }

  refreshCommissions()
  return { ok: true }
}

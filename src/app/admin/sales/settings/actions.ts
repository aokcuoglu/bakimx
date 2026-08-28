"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getSalesAccess } from "@/lib/sales/access"
import { parseIstanbulLocalDateTime } from "@/lib/sales/time"
import { salesCommissionRuleSchema } from "@/lib/validations/sales"

type Result = { ok: true } | { ok: false; error: string }

class CommissionRuleError extends Error {}

export async function createSalesCommissionRule(input: unknown): Promise<Result> {
  const access = await getSalesAccess("manageSalesCommissions")
  const parsed = salesCommissionRuleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz hakediş kuralı." }
  const effectiveFrom = parseIstanbulLocalDateTime(parsed.data.effectiveFrom)
  if (!effectiveFrom) return { ok: false, error: "Geçerli bir yürürlük tarihi girin." }
  const rateBps = Math.round(parsed.data.ratePercent * 100)

  try {
    await prisma.$transaction(async (tx) => {
      const latest = await tx.salesCommissionRule.findFirst({
        where: {
          planTier: parsed.data.planTier,
          billingCycle: parsed.data.billingCycle,
        },
        orderBy: { effectiveFrom: "desc" },
        select: { id: true, effectiveFrom: true, effectiveTo: true },
      })
      if (latest && effectiveFrom <= latest.effectiveFrom) {
        throw new CommissionRuleError("Yeni yürürlük tarihi mevcut son kuraldan sonra olmalıdır.")
      }
      if (latest?.effectiveTo) {
        throw new CommissionRuleError("Kural zaman çizelgesi tutarsız; yeni kural eklenemedi.")
      }
      if (latest) {
        const closed = await tx.salesCommissionRule.updateMany({
          where: { id: latest.id, effectiveTo: null },
          data: { effectiveTo: effectiveFrom },
        })
        if (closed.count !== 1) throw new CommissionRuleError("Kural başka bir işlem tarafından güncellendi.")
      }
      await tx.salesCommissionRule.create({
        data: {
          planTier: parsed.data.planTier,
          billingCycle: parsed.data.billingCycle,
          rateBps,
          effectiveFrom,
          createdById: access.userId,
        },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  } catch (error) {
    if (error instanceof CommissionRuleError) return { ok: false, error: error.message }
    if ((error as { code?: string })?.code === "P2002" || (error as { code?: string })?.code === "P2034") {
      return { ok: false, error: "Kural aynı anda değiştirildi. Güncelleyip yeniden deneyin." }
    }
    throw error
  }

  revalidatePath("/admin/sales/settings")
  return { ok: true }
}

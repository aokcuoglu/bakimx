"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { getSalesAccess } from "@/lib/sales/access"
import { istanbulMonthBounds } from "@/lib/sales/time"
import { salesMonthlyTargetSchema } from "@/lib/validations/sales"

type Result = { ok: true } | { ok: false; error: string }

export async function setSalesMonthlyTarget(input: unknown): Promise<Result> {
  const access = await getSalesAccess("manageSalesAdvisors")
  if (access.kind !== "admin") return { ok: false, error: "Bu işlem için yönetici yetkisi gerekir." }

  const parsed = salesMonthlyTargetSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz hedef değerleri." }

  const advisor = await prisma.salesAdvisor.findFirst({
    where: { id: parsed.data.advisorId, disabledAt: null },
    select: { id: true },
  })
  if (!advisor) return { ok: false, error: "Etkin satış danışmanı bulunamadı." }

  const period = istanbulMonthBounds(parsed.data.month)
  if (period.key !== parsed.data.month) return { ok: false, error: "Geçerli bir hedef ayı seçin." }
  const values = {
    newLeadTarget: parsed.data.newLeadTarget,
    qualifiedInteractionTarget: parsed.data.qualifiedInteractionTarget,
    completedDemoTarget: parsed.data.completedDemoTarget,
    wonWorkshopTarget: parsed.data.wonWorkshopTarget,
    netSalesTargetMinor: Math.round(parsed.data.netSalesTarget * 100),
    setById: access.userId,
  }

  await prisma.salesAdvisorMonthlyTarget.upsert({
    where: { advisorId_monthStart: { advisorId: advisor.id, monthStart: period.start } },
    create: { advisorId: advisor.id, monthStart: period.start, ...values },
    update: values,
  })

  revalidatePath("/admin/sales")
  revalidatePath("/admin/sales/performance")
  return { ok: true }
}

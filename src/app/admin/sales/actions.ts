"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { getSalesAccess, assertSalesLeadAccess } from "@/lib/sales/access"
import { salesActivitySchema, salesCommissionSchema, salesDiscountCodeSchema, salesDiscountCodeUpdateSchema, salesLeadSchema, salesLeadStatusSchema } from "@/lib/validations/sales"
import { workshopCodeCandidate } from "@/lib/workshop-code"

type Result = { ok: true } | { ok: false; error: string }

const refresh = () => revalidatePath("/admin/sales")

export async function createSalesLead(input: unknown): Promise<Result> {
  const access = await getSalesAccess("manageSalesPipeline")
  const parsed = salesLeadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz kayıt" }
  const data = parsed.data
  await prisma.salesLead.create({
    data: {
      businessName: data.businessName,
      contactName: data.contactName,
      phone: data.phone,
      email: data.email || null,
      city: data.city || null,
      notes: data.notes || null,
      // Platform yöneticisi kaydı merkezi havuzda bırakabilir; danışman kendi
      // adına açtığı kaydın sahibi olur.
      advisorId: access.advisorId,
    },
  })
  refresh()
  return { ok: true }
}

export async function setSalesLeadStatus(leadId: string, status: string): Promise<Result> {
  const access = await getSalesAccess("manageSalesPipeline")
  const parsed = salesLeadStatusSchema.safeParse(status)
  if (!leadId || !parsed.success) return { ok: false, error: "Geçersiz satış aşaması." }
  const lead = await prisma.salesLead.findUnique({ where: { id: leadId }, select: { advisorId: true, source: true } })
  const authorizedLead = assertSalesLeadAccess(access, lead)
  await prisma.$transaction(async (tx) => {
    await tx.salesLead.update({
      where: { id: leadId },
      data: { status: parsed.data, lostReason: parsed.data === "lost" ? "Belirtilmedi" : null },
    })
    if (authorizedLead.source === "customer_referral" && ["contacted", "won", "lost"].includes(parsed.data)) {
      await tx.salesReferral.updateMany({
        where: { leadId },
        data: { status: parsed.data as "contacted" | "won" | "lost" },
      })
    }
  })
  refresh()
  return { ok: true }
}

export async function addSalesActivity(leadId: string, input: unknown): Promise<Result> {
  const access = await getSalesAccess("manageSalesPipeline")
  const parsed = salesActivitySchema.safeParse(input)
  if (!leadId) return { ok: false, error: "Satış adayı seçilmedi." }
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz görüşme" }
  const lead = await prisma.salesLead.findUnique({ where: { id: leadId }, select: { advisorId: true } })
  assertSalesLeadAccess(access, lead)
  const nextActionAt = parsed.data.nextActionAt ? new Date(parsed.data.nextActionAt) : null
  if (nextActionAt && Number.isNaN(nextActionAt.getTime())) return { ok: false, error: "Geçersiz takip tarihi." }
  await prisma.$transaction([
    prisma.salesActivity.create({
      data: { leadId, type: parsed.data.type, summary: parsed.data.summary, nextActionAt, createdById: access.userId },
    }),
    prisma.salesLead.update({ where: { id: leadId }, data: { nextActionAt } }),
  ])
  refresh()
  return { ok: true }
}

export async function updateSalesCommission(id: string, input: unknown, status: "approved" | "paid" | "void"): Promise<Result> {
  await getSalesAccess("manageSalesCommissions")
  const parsed = salesCommissionSchema.safeParse(input)
  if (!id) return { ok: false, error: "Hakediş seçilmedi." }
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz hakediş" }
  const now = new Date()
  await prisma.salesCommission.update({
    where: { id },
    data: {
      amountMinor: parsed.data.amountMinor,
      note: parsed.data.note || null,
      status,
      approvedAt: status === "approved" ? now : undefined,
      paidAt: status === "paid" ? now : undefined,
    },
  })
  refresh()
  return { ok: true }
}

/** Creates the real, not-yet-provisioned workshop record for a won lead. A
 * platform admin completes owner invitation through the existing admin flow. */
export async function convertSalesLead(leadId: string): Promise<Result> {
  const access = await getSalesAccess("manageSalesPipeline")
  if (access.kind !== "admin") return { ok: false, error: "İş yeri hesabını yalnız yöneticiler açabilir." }
  const lead = await prisma.salesLead.findUnique({ where: { id: leadId } })
  if (!lead) return { ok: false, error: "Satış adayı bulunamadı." }
  if (lead.workshopId) return { ok: false, error: "Bu aday zaten bir iş yerine bağlı." }

  let loginCode = workshopCodeCandidate(lead.businessName)
  for (let suffix = 2; await prisma.workshop.findUnique({ where: { loginCode }, select: { id: true } }); suffix += 1) {
    loginCode = `${workshopCodeCandidate(lead.businessName).slice(0, 17)}-${suffix}`
  }
  const workshop = await prisma.workshop.create({
    data: {
      loginCode,
      name: lead.businessName,
      phone: lead.phone,
      city: lead.city || "Belirtilmedi",
      address: lead.address || "Belirtilmedi",
      email: lead.email,
      approvalStatus: "pending",
      subscriptionStatus: "trialing",
      acquisitionSource: lead.source === "field" ? (lead.advisorId ? "sales_advisor" : "field_visit") : lead.source === "public_demo_request" ? "website" : lead.source === "customer_referral" ? "referral" : "unknown",
      acquisitionAdvisorId: lead.advisorId,
    },
  })
  await prisma.salesLead.update({ where: { id: lead.id }, data: { workshopId: workshop.id, status: "won" } })
  refresh()
  return { ok: true }
}

function generateDiscountCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = "BKM-"
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function generateSalesDiscountCode(input: unknown): Promise<Result & { code?: string; discountPercent?: number; expiresAt?: string }> {
  const access = await getSalesAccess("manageSalesPipeline")
  const parsed = salesDiscountCodeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz indirim kodu" }
  const { discountPercent, leadId } = parsed.data

  if (leadId) {
    const lead = await prisma.salesLead.findUnique({ where: { id: leadId }, select: { advisorId: true } })
    assertSalesLeadAccess(access, lead)
  }

  let code = generateDiscountCode()
  for (let i = 0; i < 10; i++) {
    const exists = await prisma.salesDiscountCode.findUnique({ where: { code }, select: { id: true } })
    if (!exists) break
    code = generateDiscountCode()
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const discountCode = await prisma.salesDiscountCode.create({
    data: {
      code,
      discountPercent,
      advisorId: access.advisorId,
      leadId: leadId || null,
      expiresAt,
    },
  })

  refresh()
  return { ok: true, code: discountCode.code, discountPercent, expiresAt: expiresAt.toISOString() }
}

async function getDiscountCodeForUpdate(id: string) {
  const access = await getSalesAccess("manageSalesPipeline")
  const discountCode = await prisma.salesDiscountCode.findUnique({
    where: { id },
    select: { id: true, advisorId: true, usedAt: true, disabledAt: true },
  })
  if (!discountCode || (access.kind === "advisor" && discountCode.advisorId !== access.advisorId)) {
    return null
  }
  return discountCode
}

export async function updateSalesDiscountCode(id: string, input: unknown): Promise<Result> {
  const discountCode = await getDiscountCodeForUpdate(id)
  if (!discountCode) return { ok: false, error: "Bu indirim koduna erişim yetkiniz yok." }

  const parsed = salesDiscountCodeUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz geçerlilik tarihi." }
  const expiresAt = new Date(`${parsed.data.expiresAt}T23:59:59.999`)
  if (Number.isNaN(expiresAt.getTime())) return { ok: false, error: "Geçersiz geçerlilik tarihi." }
  if (discountCode.disabledAt) return { ok: false, error: "Pasif kodun süresi değiştirilemez." }
  if (discountCode.usedAt) return { ok: false, error: "Kullanılmış kodun süresi değiştirilemez." }

  await prisma.salesDiscountCode.update({ where: { id }, data: { expiresAt } })
  refresh()
  return { ok: true }
}

export async function deactivateSalesDiscountCode(id: string): Promise<Result> {
  const discountCode = await getDiscountCodeForUpdate(id)
  if (!discountCode) return { ok: false, error: "Bu indirim koduna erişim yetkiniz yok." }
  if (discountCode.disabledAt) return { ok: true }
  if (discountCode.usedAt) return { ok: false, error: "Kullanılmış kod pasife alınamaz." }

  await prisma.salesDiscountCode.update({ where: { id }, data: { disabledAt: new Date() } })
  refresh()
  return { ok: true }
}

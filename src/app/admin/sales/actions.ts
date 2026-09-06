"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/db"
import { isUniqueConstraintError } from "@/lib/prisma-errors"
import { getSalesAccess, assertSalesLeadAccess, salesLeadScope } from "@/lib/sales/access"
import {
  isSalesLeadAttributionFrozen,
  leadStatusForActivityResult,
  normalizeSalesEmail,
  normalizeSalesPhone,
  taskDurationForActivityResult,
  taskTypeForActivityResult,
} from "@/lib/sales/crm"
import { canManageSalesDiscountCode, resolveSalesDiscountAssignment } from "@/lib/sales/discount-policy"
import {
  buildSalesRegistrationPath,
  generateSalesRegistrationToken,
  salesRegistrationLinkExpiry,
} from "@/lib/sales/registration-link"
import {
  salesActivitySchema,
  salesDiscountCodeSchema,
  salesDiscountCodeUpdateSchema,
  salesLeadAssignmentSchema,
  salesLeadSchema,
  salesLeadStatusSchema,
  salesTaskResolutionSchema,
  salesTaskSchema,
} from "@/lib/validations/sales"

type DuplicateLead = {
  id: string
  businessName: string
  phone: string
  email: string | null
  matchedBy: ("phone" | "email")[]
}

export type SalesActionResult =
  | { ok: true }
  | { ok: false; error: string; code?: "duplicate" | "place_conflict"; duplicates?: DuplicateLead[] }

type Result = SalesActionResult

type RegistrationLinkResult = Result & {
  registrationPath?: string
  expiresAt?: string
}

class SalesWorkflowError extends Error {}

const refresh = (leadId?: string) => {
  revalidatePath("/admin/sales")
  revalidatePath("/admin/sales/leads")
  if (leadId) revalidatePath(`/admin/sales/leads/${leadId}`)
}

export async function createSalesLead(input: unknown): Promise<Result> {
  const access = await getSalesAccess("manageSalesPipeline")
  const parsed = salesLeadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz kayıt" }
  const data = parsed.data
  const normalizedPhone = normalizeSalesPhone(data.phone)
  const normalizedEmail = normalizeSalesEmail(data.email)
  const duplicateIdentity = [
    ...(normalizedPhone ? [{ normalizedPhone }] : []),
    ...(normalizedEmail ? [{ normalizedEmail }] : []),
  ]

  if (data.googlePlaceId) {
    const placeConflict = await prisma.salesLead.findUnique({
      where: { googlePlaceId: data.googlePlaceId },
      select: { advisorId: true },
    })
    if (placeConflict) {
      return {
        ok: false,
        code: "place_conflict",
        error: access.kind === "advisor" && placeConflict.advisorId !== access.advisorId
          ? "Bu Google işletmesi başka bir danışmanın portföyünde bulunuyor."
          : "Bu Google işletmesi satış portföyüne daha önce eklenmiş.",
      }
    }
  }

  if (!data.allowDuplicate && duplicateIdentity.length > 0) {
    const duplicates = await prisma.salesLead.findMany({
      where: {
        ...salesLeadScope(access),
        OR: duplicateIdentity,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        businessName: true,
        phone: true,
        email: true,
        normalizedPhone: true,
        normalizedEmail: true,
      },
    })
    if (duplicates.length > 0) {
      return {
        ok: false,
        code: "duplicate",
        error: "Aynı telefon veya e-posta ile daha önce açılmış adaylar var.",
        duplicates: duplicates.map((duplicate) => ({
          id: duplicate.id,
          businessName: duplicate.businessName,
          phone: duplicate.phone,
          email: duplicate.email,
          matchedBy: [
            ...(normalizedPhone && duplicate.normalizedPhone === normalizedPhone ? ["phone" as const] : []),
            ...(normalizedEmail && duplicate.normalizedEmail === normalizedEmail ? ["email" as const] : []),
          ],
        })),
      }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const lead = await tx.salesLead.create({
        data: {
          businessName: data.businessName,
          contactName: data.contactName,
          phone: data.phone,
          normalizedPhone,
          email: data.email || null,
          normalizedEmail,
          city: data.city || null,
          district: data.district || null,
          neighborhood: data.neighborhood || null,
          route: data.route || null,
          streetNumber: data.streetNumber || null,
          postalCode: data.postalCode || null,
          address: data.address || null,
          formattedAddress: data.formattedAddress || null,
          googlePlaceId: data.googlePlaceId || null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          locationSource: data.locationSource ?? null,
          locationConfirmedAt: data.locationConfirmed ? new Date() : null,
          monthlyVehicles: data.monthlyVehicles || null,
          notes: data.notes || null,
          // Platform yöneticisi kaydı merkezi havuzda bırakabilir; danışman kendi
          // adına açtığı kaydın sahibi olur.
          advisorId: access.advisorId,
        },
      })
      if (access.advisorId) {
        await tx.salesLeadAssignment.create({
          data: { leadId: lead.id, toAdvisorId: access.advisorId, actorId: access.userId },
        })
      }
    })
  } catch (error) {
    if (isUniqueConstraintError(error, "googlePlaceId")) {
      return { ok: false, code: "place_conflict", error: "Bu Google işletmesi satış portföyüne daha önce eklenmiş." }
    }
    throw error
  }
  refresh()
  return { ok: true }
}

export async function updateSalesLeadLocation(leadId: string, input: unknown): Promise<Result> {
  const access = await getSalesAccess("manageSalesPipeline")
  const parsed = salesLeadSchema.safeParse(input)
  if (!leadId || !parsed.success) {
    return { ok: false, error: parsed.success ? "Geçersiz şirket adayı." : parsed.error.issues[0]?.message ?? "Geçersiz konum" }
  }
  const data = parsed.data
  if (data.latitude == null || data.longitude == null || !data.locationSource || !data.locationConfirmed) {
    return { ok: false, error: "Haritadaki şirket konumunu doğrulayın." }
  }

  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    select: { advisorId: true },
  })
  assertSalesLeadAccess(access, lead)

  if (data.googlePlaceId) {
    const placeConflict = await prisma.salesLead.findFirst({
      where: { googlePlaceId: data.googlePlaceId, id: { not: leadId } },
      select: { id: true },
    })
    if (placeConflict) {
      return { ok: false, code: "place_conflict", error: "Bu Google işletmesi başka bir satış adayına bağlı." }
    }
  }

  try {
    const updated = await prisma.salesLead.updateMany({
      where: { id: leadId, ...(access.kind === "advisor" ? { advisorId: access.advisorId } : {}) },
      data: {
        city: data.city || null,
        district: data.district || null,
        neighborhood: data.neighborhood || null,
        route: data.route || null,
        streetNumber: data.streetNumber || null,
        postalCode: data.postalCode || null,
        address: data.address || null,
        formattedAddress: data.formattedAddress || null,
        googlePlaceId: data.googlePlaceId || null,
        latitude: data.latitude,
        longitude: data.longitude,
        locationSource: data.locationSource,
        locationConfirmedAt: new Date(),
      },
    })
    if (updated.count !== 1) return { ok: false, error: "Şirket konumu güncellenemedi." }
  } catch (error) {
    if (isUniqueConstraintError(error, "googlePlaceId")) {
      return { ok: false, code: "place_conflict", error: "Bu Google işletmesi başka bir satış adayına bağlı." }
    }
    throw error
  }

  refresh(leadId)
  return { ok: true }
}

export async function setSalesLeadStatus(leadId: string, status: string): Promise<Result> {
  const access = await getSalesAccess("manageSalesPipeline")
  const parsed = salesLeadStatusSchema.safeParse(status)
  if (!leadId || !parsed.success) return { ok: false, error: "Geçersiz satış aşaması." }
  if (["won", "lost"].includes(parsed.data)) {
    return { ok: false, error: "Kazanım ve kayıp, zorunlu sonuç alanlarıyla görüşme kaydından tamamlanmalıdır." }
  }
  if (parsed.data === "onboarding") {
    return { ok: false, error: "Kayıt aşaması yalnız güvenli kayıt bağlantısı oluşturularak başlatılabilir." }
  }
  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    select: { advisorId: true, source: true, status: true, attributionFrozenAt: true },
  })
  const authorizedLead = assertSalesLeadAccess(access, lead)
  if (isSalesLeadAttributionFrozen(authorizedLead)) {
    return { ok: false, error: "Kazanılmış adayın satış aşaması değiştirilemez." }
  }
  try {
    await prisma.$transaction(async (tx) => {
      const currentLead = await tx.salesLead.findUnique({
        where: { id: leadId },
        select: { advisorId: true, source: true, status: true, attributionFrozenAt: true },
      })
      const currentAuthorizedLead = assertSalesLeadAccess(access, currentLead)
      if (isSalesLeadAttributionFrozen(currentAuthorizedLead)) throw new SalesWorkflowError("Kazanılmış adayın satış aşaması değiştirilemez.")
      const updated = await tx.salesLead.updateMany({
        where: {
          id: leadId,
          attributionFrozenAt: null,
          ...(access.kind === "advisor" ? { advisorId: access.advisorId } : {}),
        },
        data: { status: parsed.data, lostReason: null },
      })
      if (updated.count !== 1) throw new SalesWorkflowError("Aday erişimi veya satış aşaması başka bir işlem tarafından değiştirildi.")
      if (currentAuthorizedLead.source === "customer_referral" && ["contacted", "won", "lost"].includes(parsed.data)) {
        await tx.salesReferral.updateMany({
          where: { leadId },
          data: { status: parsed.data as "contacted" | "won" | "lost" },
        })
      }
    })
  } catch (error) {
    if (error instanceof SalesWorkflowError) return { ok: false, error: error.message }
    throw error
  }
  refresh()
  return { ok: true }
}

export async function addSalesActivity(leadId: string, input: unknown): Promise<Result> {
  const access = await getSalesAccess("manageSalesPipeline")
  const parsed = salesActivitySchema.safeParse(input)
  if (!leadId) return { ok: false, error: "Satış adayı seçilmedi." }
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz görüşme" }
  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    select: { advisorId: true, status: true, attributionFrozenAt: true, source: true },
  })
  const authorizedLead = assertSalesLeadAccess(access, lead)
  if (isSalesLeadAttributionFrozen(authorizedLead)) {
    return { ok: false, error: "Kazanılmış adaya yeni görüşme eklenemez." }
  }
  const occurredAt = parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date()
  const nextActionAt = parsed.data.nextActionAt ? new Date(parsed.data.nextActionAt) : null
  const nextStatus = leadStatusForActivityResult(parsed.data.result)

  try {
    await prisma.$transaction(async (tx) => {
      const currentLead = await tx.salesLead.findUnique({
        where: { id: leadId },
        select: { advisorId: true, status: true, attributionFrozenAt: true, source: true },
      })
      const currentAuthorizedLead = assertSalesLeadAccess(access, currentLead)
      if (isSalesLeadAttributionFrozen(currentAuthorizedLead)) {
        throw new SalesWorkflowError("Kazanılmış adaya yeni görüşme eklenemez.")
      }

      if (parsed.data.taskId) {
        const task = await tx.salesTask.findUnique({
          where: { id: parsed.data.taskId },
          select: { leadId: true, status: true },
        })
        if (!task || task.leadId !== leadId) throw new SalesWorkflowError("Görev bu adaya ait değil.")
        if (task.status !== "scheduled") throw new SalesWorkflowError("Yalnız planlanmış görev görüşmeyle tamamlanabilir.")
      }

      const activity = await tx.salesActivity.create({
        data: {
          leadId,
          type: parsed.data.type,
          result: parsed.data.result,
          summary: parsed.data.summary,
          lostReason: parsed.data.result === "lost" ? parsed.data.lostReason : null,
          occurredAt,
          nextActionAt,
          createdById: access.userId,
        },
      })

      if (parsed.data.taskId) {
        const completed = await tx.salesTask.updateMany({
          where: { id: parsed.data.taskId, leadId, status: "scheduled", completedByActivityId: null },
          data: { status: "completed", completedByActivityId: activity.id, resolvedAt: occurredAt },
        })
        if (completed.count !== 1) throw new SalesWorkflowError("Görev daha önce sonuçlandırılmış.")
      }

      if (nextActionAt) {
        await tx.salesTask.create({
          data: {
            leadId,
            type: parsed.data.nextTaskType ?? taskTypeForActivityResult(parsed.data.result),
            startsAt: nextActionAt,
            durationMinutes: parsed.data.nextTaskDurationMinutes ?? taskDurationForActivityResult(parsed.data.result),
            note: parsed.data.summary,
            createdById: access.userId,
          },
        })
      }

      const isTerminal = parsed.data.result === "won" || parsed.data.result === "lost"
      if (isTerminal) {
        await tx.salesTask.updateMany({
          where: { leadId, status: "scheduled" },
          data: { status: "cancelled", resolvedAt: occurredAt },
        })
        await tx.salesRegistrationLink.updateMany({
          where: { leadId, usedAt: null, revokedAt: null },
          data: { revokedAt: occurredAt, revokedById: access.userId },
        })
      }

      let refreshedNextActionAt = nextActionAt
      if (!nextActionAt && (parsed.data.taskId || isTerminal)) {
        const nextTask = isTerminal
          ? null
          : await tx.salesTask.findFirst({
              where: { leadId, status: "scheduled" },
              orderBy: { startsAt: "asc" },
              select: { startsAt: true },
            })
        refreshedNextActionAt = nextTask?.startsAt ?? null
      }

      const updatedLead = await tx.salesLead.updateMany({
        where: {
          id: leadId,
          attributionFrozenAt: null,
          ...(access.kind === "advisor" ? { advisorId: access.advisorId } : {}),
        },
        data: {
          ...(nextStatus ? { status: nextStatus } : {}),
          ...(nextActionAt || parsed.data.taskId || isTerminal ? { nextActionAt: refreshedNextActionAt } : {}),
          ...(nextStatus
            ? { lostReason: parsed.data.result === "lost" ? parsed.data.lostReason : null }
            : {}),
          ...(parsed.data.result === "won" ? { attributionFrozenAt: occurredAt } : {}),
        },
      })
      if (updatedLead.count !== 1) throw new SalesWorkflowError("Aday erişimi veya ataması başka bir işlem tarafından değiştirildi.")
      if (currentAuthorizedLead.source === "customer_referral" && nextStatus && ["contacted", "won", "lost"].includes(nextStatus)) {
        await tx.salesReferral.updateMany({
          where: { leadId },
          data: { status: nextStatus as "contacted" | "won" | "lost" },
        })
      }
    })
  } catch (error) {
    if (error instanceof SalesWorkflowError) return { ok: false, error: error.message }
    throw error
  }
  refresh(leadId)
  return { ok: true }
}

export async function assignSalesLead(leadId: string, input: unknown): Promise<Result> {
  const access = await getSalesAccess("manageSalesPipeline")
  if (access.kind !== "admin") return { ok: false, error: "Aday atamasını yalnız yetkili yöneticiler yapabilir." }
  const parsed = salesLeadAssignmentSchema.safeParse(input)
  if (!leadId || !parsed.success) return { ok: false, error: "Geçersiz danışman ataması." }

  const advisorId = parsed.data.advisorId || null
  if (advisorId) {
    const target = await prisma.salesAdvisor.findUnique({
      where: { id: advisorId },
      select: { disabledAt: true, user: { select: { isActive: true } } },
    })
    if (!target || target.disabledAt || !target.user.isActive) {
      return { ok: false, error: "Etkin bir satış danışmanı seçin." }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const lead = await tx.salesLead.findUnique({
        where: { id: leadId },
        select: { advisorId: true, status: true, attributionFrozenAt: true },
      })
      if (!lead) throw new SalesWorkflowError("Satış adayı bulunamadı.")
      if (isSalesLeadAttributionFrozen(lead)) throw new SalesWorkflowError("Kazanılmış adayın danışman atfı değiştirilemez.")
      if (lead.advisorId === advisorId) return

      const updated = await tx.salesLead.updateMany({
        where: {
          id: leadId,
          advisorId: lead.advisorId,
          attributionFrozenAt: null,
          status: { not: "won" },
        },
        data: { advisorId },
      })
      if (updated.count !== 1) throw new SalesWorkflowError("Aday ataması başka bir işlem tarafından değiştirildi. Yenileyip tekrar deneyin.")

      await tx.salesLeadAssignment.create({
        data: {
          leadId,
          fromAdvisorId: lead.advisorId,
          toAdvisorId: advisorId,
          actorId: access.userId,
        },
      })
      await tx.salesRegistrationLink.updateMany({
        where: { leadId, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date(), revokedById: access.userId },
      })
    })
  } catch (error) {
    if (error instanceof SalesWorkflowError) return { ok: false, error: error.message }
    throw error
  }

  refresh(leadId)
  return { ok: true }
}

export async function createSalesTask(leadId: string, input: unknown): Promise<Result> {
  const access = await getSalesAccess("manageSalesPipeline")
  const parsed = salesTaskSchema.safeParse(input)
  if (!leadId) return { ok: false, error: "Satış adayı seçilmedi." }
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz görev" }

  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    select: { advisorId: true, status: true, attributionFrozenAt: true, nextActionAt: true },
  })
  const authorizedLead = assertSalesLeadAccess(access, lead)
  if (isSalesLeadAttributionFrozen(authorizedLead)) return { ok: false, error: "Kazanılmış adaya görev eklenemez." }

  const startsAt = new Date(parsed.data.startsAt)
  try {
    await prisma.$transaction(async (tx) => {
      const currentLead = await tx.salesLead.findUnique({
        where: { id: leadId },
        select: { advisorId: true, status: true, attributionFrozenAt: true, nextActionAt: true },
      })
      const currentAuthorizedLead = assertSalesLeadAccess(access, currentLead)
      if (isSalesLeadAttributionFrozen(currentAuthorizedLead)) throw new SalesWorkflowError("Kazanılmış adaya görev eklenemez.")
      await tx.salesTask.create({
        data: {
          leadId,
          type: parsed.data.type,
          startsAt,
          durationMinutes: parsed.data.durationMinutes,
          note: parsed.data.note || null,
          createdById: access.userId,
        },
      })
      const updatedLead = await tx.salesLead.updateMany({
        where: {
          id: leadId,
          attributionFrozenAt: null,
          ...(access.kind === "advisor" ? { advisorId: access.advisorId } : {}),
        },
        data: {
          nextActionAt: !currentAuthorizedLead.nextActionAt || startsAt < currentAuthorizedLead.nextActionAt
            ? startsAt
            : currentAuthorizedLead.nextActionAt,
        },
      })
      if (updatedLead.count !== 1) throw new SalesWorkflowError("Aday erişimi veya ataması başka bir işlem tarafından değiştirildi.")
    })
  } catch (error) {
    if (error instanceof SalesWorkflowError) return { ok: false, error: error.message }
    throw error
  }

  refresh(leadId)
  return { ok: true }
}

export async function resolveSalesTask(taskId: string, status: unknown): Promise<Result> {
  const access = await getSalesAccess("manageSalesPipeline")
  const parsed = salesTaskResolutionSchema.safeParse(status)
  if (!taskId || !parsed.success) return { ok: false, error: "Geçersiz görev sonucu." }

  const task = await prisma.salesTask.findUnique({
    where: { id: taskId },
    select: { leadId: true, status: true, lead: { select: { advisorId: true } } },
  })
  if (!task) return { ok: false, error: "Görev bulunamadı." }
  assertSalesLeadAccess(access, task.lead)
  if (task.status !== "scheduled") return { ok: false, error: "Görev daha önce sonuçlandırılmış." }

  const now = new Date()
  try {
    await prisma.$transaction(async (tx) => {
      const currentTask = await tx.salesTask.findUnique({
        where: { id: taskId },
        select: { leadId: true, status: true, lead: { select: { advisorId: true } } },
      })
      if (!currentTask || currentTask.leadId !== task.leadId) throw new SalesWorkflowError("Görev bulunamadı.")
      assertSalesLeadAccess(access, currentTask.lead)
      if (currentTask.status !== "scheduled") throw new SalesWorkflowError("Görev daha önce sonuçlandırılmış.")
      const updated = await tx.salesTask.updateMany({
        where: { id: taskId, status: "scheduled" },
        data: { status: parsed.data, resolvedAt: now },
      })
      if (updated.count !== 1) throw new SalesWorkflowError("Görev daha önce sonuçlandırılmış.")
      const nextTask = await tx.salesTask.findFirst({
        where: { leadId: task.leadId, status: "scheduled" },
        orderBy: { startsAt: "asc" },
        select: { startsAt: true },
      })
      const updatedLead = await tx.salesLead.updateMany({
        where: {
          id: task.leadId,
          ...(access.kind === "advisor" ? { advisorId: access.advisorId } : {}),
        },
        data: { nextActionAt: nextTask?.startsAt ?? null },
      })
      if (updatedLead.count !== 1) throw new SalesWorkflowError("Aday erişimi veya ataması başka bir işlem tarafından değiştirildi.")
    })
  } catch (error) {
    if (error instanceof SalesWorkflowError) return { ok: false, error: error.message }
    throw error
  }

  refresh(task.leadId)
  return { ok: true }
}

/**
 * Müşterinin mevcut kayıt sihirbazını lead + danışman atfıyla açan tek
 * kullanımlık bağlantıyı üretir. Ham token yalnız bu dönüş değerinde bulunur.
 */
export async function generateSalesRegistrationLink(leadId: string): Promise<RegistrationLinkResult> {
  const access = await getSalesAccess("manageSalesPipeline")
  if (!leadId) return { ok: false, error: "Satış adayı seçilmedi." }
  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    select: { advisorId: true, status: true, attributionFrozenAt: true, workshopId: true },
  })
  const authorizedLead = assertSalesLeadAccess(access, lead)
  if (!authorizedLead.advisorId) return { ok: false, error: "Kayıt bağlantısından önce adaya bir danışman atayın." }
  if (authorizedLead.workshopId || isSalesLeadAttributionFrozen(authorizedLead)) {
    return { ok: false, error: "Bu adayın müşteri dönüşümü daha önce tamamlanmış." }
  }
  if (authorizedLead.status === "lost") return { ok: false, error: "Kaybedilmiş aday için kayıt bağlantısı oluşturulamaz." }

  const { token, tokenHash } = generateSalesRegistrationToken()
  const now = new Date()
  const expiresAt = salesRegistrationLinkExpiry(now)

  try {
    await prisma.$transaction(async (tx) => {
      const currentLead = await tx.salesLead.findUnique({
        where: { id: leadId },
        select: { advisorId: true, status: true, attributionFrozenAt: true, workshopId: true },
      })
      const currentAuthorizedLead = assertSalesLeadAccess(access, currentLead)
      if (!currentAuthorizedLead.advisorId) throw new SalesWorkflowError("Kayıt bağlantısından önce adaya bir danışman atayın.")
      if (currentAuthorizedLead.workshopId || isSalesLeadAttributionFrozen(currentAuthorizedLead)) {
        throw new SalesWorkflowError("Bu adayın müşteri dönüşümü daha önce tamamlanmış.")
      }
      if (currentAuthorizedLead.status === "lost") throw new SalesWorkflowError("Kaybedilmiş aday için kayıt bağlantısı oluşturulamaz.")

      await tx.salesRegistrationLink.updateMany({
        where: { leadId, usedAt: null, revokedAt: null },
        data: { revokedAt: now, revokedById: access.userId },
      })
      await tx.salesRegistrationLink.create({
        data: {
          leadId,
          advisorId: currentAuthorizedLead.advisorId,
          tokenHash,
          expiresAt,
          createdById: access.userId,
        },
      })
      await tx.salesActivity.create({
        data: {
          leadId,
          type: "note",
          summary: "Güvenli müşteri kayıt bağlantısı oluşturuldu.",
          occurredAt: now,
          createdById: access.userId,
        },
      })
      const updated = await tx.salesLead.updateMany({
        where: {
          id: leadId,
          advisorId: currentAuthorizedLead.advisorId,
          workshopId: null,
          attributionFrozenAt: null,
          status: { notIn: ["won", "lost"] },
        },
        data: { status: "onboarding", lostReason: null },
      })
      if (updated.count !== 1) throw new SalesWorkflowError("Aday başka bir işlem tarafından değiştirildi. Yenileyip tekrar deneyin.")
    })
  } catch (error) {
    if (error instanceof SalesWorkflowError) return { ok: false, error: error.message }
    if ((error as { code?: string })?.code === "P2002") {
      return { ok: false, error: "Bağlantı aynı anda başka bir işlem tarafından yenilendi. Tekrar deneyin." }
    }
    throw error
  }

  refresh(leadId)
  return {
    ok: true,
    registrationPath: buildSalesRegistrationPath(token),
    expiresAt: expiresAt.toISOString(),
  }
}

function generateDiscountCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = "BKM-"
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function generateSalesDiscountCode(input: unknown): Promise<Result & { code?: string; discountPercent?: number; expiresAt?: string; fundingSource?: "advisor_margin" | "bakimx_funded" }> {
  const access = await getSalesAccess("manageSalesPipeline")
  const parsed = salesDiscountCodeSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz indirim kodu" }
  const { discountPercent, leadId } = parsed.data

  const lead = leadId
    ? await prisma.salesLead.findUnique({
        where: { id: leadId },
        select: { id: true, advisorId: true, status: true },
      })
    : null
  const policy = resolveSalesDiscountAssignment(access, parsed.data, lead)
  if (!policy.ok) return policy

  if (access.kind === "admin") {
    const activeAdvisor = await prisma.salesAdvisor.findFirst({
      where: { id: policy.assignment.advisorId, disabledAt: null },
      select: { id: true },
    })
    if (!activeAdvisor) return { ok: false, error: "Seçilen satış danışmanı aktif değil." }
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
      ...policy.assignment,
      expiresAt,
    },
  })

  refresh()
  return {
    ok: true,
    code: discountCode.code,
    discountPercent,
    expiresAt: expiresAt.toISOString(),
    fundingSource: policy.assignment.fundingSource,
  }
}

async function getDiscountCodeForUpdate(id: string) {
  const access = await getSalesAccess("manageSalesPipeline")
  const discountCode = await prisma.salesDiscountCode.findUnique({
    where: { id },
    select: { id: true, advisorId: true, fundingSource: true, usedAt: true, disabledAt: true },
  })
  if (!discountCode || !canManageSalesDiscountCode(access, discountCode)) {
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

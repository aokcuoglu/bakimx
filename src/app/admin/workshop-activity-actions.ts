"use server"

import { requireAdminCapability } from "@/lib/admin"
import { prisma } from "@/lib/db"
import {
  auditActionLabel,
  calendarSyncSubjectLabel,
  communicationSubjectLabel,
  reminderJobLabel,
} from "@/lib/admin/activity-labels"
import {
  normalizeActivityPage,
  parseActivityDateRange,
  validWorkshopActivityId,
  WORKSHOP_ACTIVITY_PAGE_SIZE,
  type ActivityQueryInput,
} from "@/lib/admin/workshop-activity-query"

export type AuditActivityRow = {
  id: string
  action: string
  actor: string
  createdAt: string
}

export type CommunicationActivityKind = "communication" | "reminder" | "calendar"

export type CommunicationActivityRow = {
  id: string
  kind: "İletişim" | "Hatırlatma" | "Takvim"
  subject: string
  status: string
  detail: string
  createdAt: string
}

type QueryResult<Row> =
  | { ok: true; rows: Row[]; page: number; total: number }
  | { ok: false; error: string }

function invalidInput(input: ActivityQueryInput): string | null {
  if (!input || typeof input !== "object") return "Sorgu bilgisi geçersiz."
  if (!validWorkshopActivityId(input.workshopId)) return "İş yeri bilgisi geçersiz."
  if (typeof input.from !== "string" || typeof input.to !== "string") return "Tarih aralığı geçersiz."
  if (!Number.isSafeInteger(input.page) || input.page < 1) return "Sayfa bilgisi geçersiz."
  return null
}

export async function queryWorkshopAudit(
  input: ActivityQueryInput & { action: string },
): Promise<QueryResult<AuditActivityRow>> {
  await requireAdminCapability("viewAudit")

  const inputError = invalidInput(input)
  if (inputError) return { ok: false, error: inputError }
  if (typeof input.action !== "string" || input.action.length > 191) return { ok: false, error: "İşlem türü geçersiz." }
  const dates = parseActivityDateRange(input.from, input.to)
  if (!dates.ok) return dates

  const where = {
    workshopId: input.workshopId,
    ...(input.action ? { action: input.action } : {}),
    ...(dates.range ? { createdAt: dates.range } : {}),
  }
  const total = await prisma.auditLog.count({ where })
  const page = normalizeActivityPage(input.page, total)
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * WORKSHOP_ACTIVITY_PAGE_SIZE,
    take: WORKSHOP_ACTIVITY_PAGE_SIZE,
    include: { actorUser: { select: { email: true } } },
  })

  return {
    ok: true,
    page,
    total,
    rows: logs.map((log) => ({
      id: log.id,
      action: auditActionLabel(log.action),
      actor: log.actorUser?.email ?? "sistem",
      createdAt: log.createdAt.toISOString(),
    })),
  }
}

export async function queryWorkshopCommunications(
  input: ActivityQueryInput & { kind: CommunicationActivityKind | ""; status: string },
): Promise<QueryResult<CommunicationActivityRow>> {
  await requireAdminCapability("viewAudit")

  const inputError = invalidInput(input)
  if (inputError) return { ok: false, error: inputError }
  if (!["", "communication", "reminder", "calendar"].includes(input.kind)) return { ok: false, error: "Kayıt türü geçersiz." }
  if (typeof input.status !== "string" || input.status.length > 64) return { ok: false, error: "Durum bilgisi geçersiz." }
  const dates = parseActivityDateRange(input.from, input.to)
  if (!dates.ok) return dates

  const includeCommunication = !input.kind || input.kind === "communication"
  const includeReminder = !input.kind || input.kind === "reminder"
  const includeCalendar = !input.kind || input.kind === "calendar"

  const [communicationTotal, reminderTotal, calendarTotal] = await Promise.all([
    includeCommunication
      ? prisma.communicationLog.count({ where: { workshopId: input.workshopId, ...(input.status ? { status: input.status } : {}), ...(dates.range ? { sentAt: dates.range } : {}) } })
      : 0,
    includeReminder
      ? prisma.reminderExecutionLog.count({ where: { workshopId: input.workshopId, ...(input.status ? { status: input.status } : {}), ...(dates.range ? { executedAt: dates.range } : {}) } })
      : 0,
    includeCalendar
      ? prisma.calendarSyncLog.count({ where: { workshopId: input.workshopId, ...(input.status ? { status: input.status } : {}), ...(dates.range ? { syncedAt: dates.range } : {}) } })
      : 0,
  ])

  const total = communicationTotal + reminderTotal + calendarTotal
  const page = normalizeActivityPage(input.page, total)
  const take = page * WORKSHOP_ACTIVITY_PAGE_SIZE
  const [communicationLogs, reminderLogs, calendarLogs] = await Promise.all([
    includeCommunication
      ? prisma.communicationLog.findMany({ where: { workshopId: input.workshopId, ...(input.status ? { status: input.status } : {}), ...(dates.range ? { sentAt: dates.range } : {}) }, orderBy: { sentAt: "desc" }, take })
      : [],
    includeReminder
      ? prisma.reminderExecutionLog.findMany({ where: { workshopId: input.workshopId, ...(input.status ? { status: input.status } : {}), ...(dates.range ? { executedAt: dates.range } : {}) }, orderBy: { executedAt: "desc" }, take })
      : [],
    includeCalendar
      ? prisma.calendarSyncLog.findMany({ where: { workshopId: input.workshopId, ...(input.status ? { status: input.status } : {}), ...(dates.range ? { syncedAt: dates.range } : {}) }, orderBy: { syncedAt: "desc" }, take })
      : [],
  ])

  const rows: CommunicationActivityRow[] = [
    ...communicationLogs.map((log) => ({
      id: log.id,
      kind: "İletişim" as const,
      subject: communicationSubjectLabel(log.type, log.templateKey),
      status: log.status,
      detail: "İletişim gönderimi",
      createdAt: log.sentAt.toISOString(),
    })),
    ...reminderLogs.map((log) => ({
      id: log.id,
      kind: "Hatırlatma" as const,
      subject: reminderJobLabel(log.jobType),
      status: log.status,
      detail: `${log.sentCount} gönderildi · ${log.failedCount} başarısız`,
      createdAt: log.executedAt.toISOString(),
    })),
    ...calendarLogs.map((log) => ({
      id: log.id,
      kind: "Takvim" as const,
      subject: calendarSyncSubjectLabel(log.eventType),
      status: log.status,
      detail: "Takvim eşitlemesi",
      createdAt: log.syncedAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice((page - 1) * WORKSHOP_ACTIVITY_PAGE_SIZE, page * WORKSHOP_ACTIVITY_PAGE_SIZE)

  return { ok: true, rows, page, total }
}

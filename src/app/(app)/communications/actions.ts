"use server"

import { prisma } from "@/lib/db"
import { requireFeatureWorkshop } from "@/lib/auth"

async function requireAuth() {
  return (await requireFeatureWorkshop("communications")).user
}

export async function getCommunicationLogs(filters?: {
  type?: string
  status?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}) {
  const { workshopId } = await requireAuth()
  // `internal: false` workshopId kadar kritik: platform yöneticilerine giden
  // sistem uyarıları da dedup için bu kiracıya bağlı loglanır, ama kiracıya
  // gösterilirse admin e-posta adresleri sızar (issue #194).
  const where: Record<string, unknown> = { workshopId, internal: false }

  if (filters?.type) where.type = filters.type
  if (filters?.status) where.status = filters.status

  if (filters?.dateFrom || filters?.dateTo) {
    const sentAt: Record<string, Date> = {}
    if (filters.dateFrom) sentAt.gte = new Date(filters.dateFrom)
    if (filters.dateTo) sentAt.lte = new Date(filters.dateTo)
    where.sentAt = sentAt
  }

  if (filters?.search) {
    const q = filters.search
    where.OR = [
      { recipient: { contains: q, mode: "insensitive" } },
      { templateKey: { contains: q, mode: "insensitive" } },
      { provider: { contains: q, mode: "insensitive" } },
    ]
  }

  const logs = await prisma.communicationLog.findMany({
    where,
    orderBy: { sentAt: "desc" },
    take: 200,
  })

  return logs.map((log) => ({
    id: log.id,
    type: log.type,
    provider: log.provider,
    recipient: log.recipient,
    status: log.status,
    templateKey: log.templateKey,
    entityType: log.entityType,
    entityId: log.entityId,
    providerId: log.providerId,
    errorMessage: log.errorMessage,
    sentAt: log.sentAt.toISOString(),
    createdAt: log.createdAt.toISOString(),
  }))
}

export async function getCommunicationStats() {
  const { workshopId } = await requireAuth()
  // Sayaçlar listeyle aynı görünürlük kuralına uymalı — aksi halde "Gönderildi: 5"
  // deyip listede 1 satır göstermek gizlenen kayıtları ele verir.
  const visible = { workshopId, internal: false }
  // `skipped` DA sayılmalı: müşteri onay vermediğinde sendCommunication gönderim
  // yapmadan satır yazar (kanal başına bir tane). Sayılmadığı sürece "Gönderildi 5"
  // deyip listede 20 satır göstermek kaçınılmazdı (issue #246).
  const [sent, failed, pending, skipped] = await Promise.all([
    prisma.communicationLog.count({ where: { ...visible, status: "sent" } }),
    prisma.communicationLog.count({ where: { ...visible, status: "failed" } }),
    prisma.communicationLog.count({ where: { ...visible, status: "pending" } }),
    prisma.communicationLog.count({ where: { ...visible, status: "skipped" } }),
  ])

  const byType = await prisma.communicationLog.groupBy({
    by: ["type"],
    where: visible,
    _count: true,
  })

  const typeMap: Record<string, number> = {}
  for (const t of byType) {
    typeMap[t.type] = t._count
  }

  return { sent, failed, pending, skipped, byType: typeMap }
}

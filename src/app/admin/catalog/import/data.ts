import { prisma } from "@/lib/db"

/**
 * İçe aktarma ekranının okuma yolu. Admin tarafı olduğu için tenant filtresi
 * yok (katalog global); yetki kapısı çağıran sayfada.
 */

export const IMPORT_HISTORY_LIMIT = 20

export interface CatalogImportHistoryRow {
  id: string
  fileName: string
  brandName: string
  mode: "upsert" | "price_stock_only"
  status: "pending" | "previewed" | "applied" | "failed" | "cancelled"
  pricesIncludeVat: boolean
  totalRows: number
  createdCount: number
  updatedCount: number
  skippedCount: number
  errorCount: number
  actorLabel: string
  appliedAt: string | null
  createdAt: string
}

export async function getCatalogImportHistory(
  take = IMPORT_HISTORY_LIMIT,
): Promise<CatalogImportHistoryRow[]> {
  const rows = await prisma.bakimxProductImport.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      fileName: true,
      mode: true,
      status: true,
      pricesIncludeVat: true,
      totalRows: true,
      createdCount: true,
      updatedCount: true,
      skippedCount: true,
      errorCount: true,
      createdByUserId: true,
      appliedAt: true,
      createdAt: true,
      brand: { select: { name: true } },
    },
  })
  if (rows.length === 0) return []

  // `createdByUserId` bir FK değil (katalog global, kullanıcı tenant'a bağlı) —
  // e-posta ayrı bir toplu sorguyla çözülür; kullanıcı silinmişse id kalır.
  const actorIds = [...new Set(rows.map((r) => r.createdByUserId))]
  const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } })
  const emailById = new Map(actors.map((a) => [a.id, a.email]))

  return rows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    brandName: row.brand?.name ?? "—",
    mode: row.mode,
    status: row.status,
    pricesIncludeVat: row.pricesIncludeVat,
    totalRows: row.totalRows,
    createdCount: row.createdCount,
    updatedCount: row.updatedCount,
    skippedCount: row.skippedCount,
    errorCount: row.errorCount,
    actorLabel: emailById.get(row.createdByUserId) ?? row.createdByUserId,
    appliedAt: row.appliedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }))
}

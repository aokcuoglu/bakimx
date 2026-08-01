import { prisma } from "@/lib/db"
import type { LaborCatalogRow, LaborKPIs } from "@/lib/labor/types"

const ROW_SELECT = {
  id: true,
  code: true,
  name: true,
  category: true,
  defaultPriceKurus: true,
  description: true,
  isActive: true,
} as const

/**
 * Atölyenin işçilik tanımları, ada göre sıralı.
 * `activeOnly` iş emri/teklif önerileri için kullanılır: pasif kalemler önerilmez.
 */
export async function getLaborCatalog(
  workshopId: string,
  opts?: { activeOnly?: boolean }
): Promise<LaborCatalogRow[]> {
  return prisma.laborCatalogItem.findMany({
    where: { workshopId, ...(opts?.activeOnly ? { isActive: true } : {}) },
    select: ROW_SELECT,
    orderBy: { name: "asc" },
  })
}

export async function getLaborKPIs(workshopId: string): Promise<LaborKPIs> {
  const [total, active] = await Promise.all([
    prisma.laborCatalogItem.count({ where: { workshopId } }),
    prisma.laborCatalogItem.count({ where: { workshopId, isActive: true } }),
  ])
  return { total, active, inactive: total - active }
}

/** Modal'daki kategori Autocomplete'ini besler: atölyenin kullandığı kategoriler. */
export async function getLaborCategories(workshopId: string): Promise<string[]> {
  const rows = await prisma.laborCatalogItem.findMany({
    where: { workshopId, category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  })
  return rows.map((r) => r.category).filter((c): c is string => !!c)
}

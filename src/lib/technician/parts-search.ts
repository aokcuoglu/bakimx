import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

/**
 * Teknisyen parça sorgulaması. /parts saha rollerine kapalıdır çünkü alış
 * fiyatı ve tedarikçi bilgisi içerir; bu sorgu yalnız sahada gereken alanları
 * döndürür. Alana ekleme yaparken maliyet/tedarikçi alanı ekleme —
 * parts-search.test.ts bunu engeller.
 */
export const TECHNICIAN_PART_SELECT = {
  id: true,
  name: true,
  sku: true,
  oemNo: true,
  brand: true,
  category: true,
  unit: true,
  stockQty: true,
  criticalStockQty: true,
  salePrice: true,
} satisfies Prisma.PartStockItemSelect

export type TechnicianPartRow = Prisma.PartStockItemGetPayload<{
  select: typeof TECHNICIAN_PART_SELECT
}>

export const TECHNICIAN_PART_SEARCH_LIMIT = 50
export const TECHNICIAN_PART_QUERY_MAX_LENGTH = 100

export function normalizePartQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  return (value ?? "").trim().slice(0, TECHNICIAN_PART_QUERY_MAX_LENGTH)
}

export async function searchTechnicianParts(
  workshopId: string,
  query: string
): Promise<TechnicianPartRow[]> {
  if (!query) return []
  return prisma.partStockItem.findMany({
    where: {
      workshopId,
      isActive: true,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
        { oemNo: { contains: query, mode: "insensitive" } },
        { brand: { contains: query, mode: "insensitive" } },
        { category: { contains: query, mode: "insensitive" } },
        { barcode: { contains: query } },
      ],
    },
    select: TECHNICIAN_PART_SELECT,
    orderBy: { name: "asc" },
    take: TECHNICIAN_PART_SEARCH_LIMIT,
  })
}

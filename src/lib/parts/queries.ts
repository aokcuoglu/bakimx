import { prisma } from "@/lib/db"

export interface PartListRow {
  id: string
  name: string
  sku: string | null
  oemNo: string | null
  brand: string | null
  category: string | null
  stockQty: number
  criticalStockQty: number
  salePrice: number | null
  unit: string
  shelfLocation: string | null
  isActive: boolean
  createdAt: string
}

export interface PartKPIs {
  total: number
  inStock: number
  critical: number
  outOfStock: number
  inactive: number
}

export async function getPartKPIs(workshopId: string): Promise<PartKPIs> {
  const parts = await prisma.partStockItem.findMany({
    where: { workshopId },
    select: { stockQty: true, criticalStockQty: true, isActive: true },
  })

  let inStock = 0
  let critical = 0
  let outOfStock = 0
  let inactive = 0

  for (const p of parts) {
    if (!p.isActive) {
      inactive++
    } else if (p.stockQty <= 0) {
      outOfStock++
    } else if (p.stockQty <= p.criticalStockQty) {
      critical++
    } else {
      inStock++
    }
  }

  return {
    total: parts.length,
    inStock,
    critical,
    outOfStock,
    inactive,
  }
}

export interface CriticalStockItem {
  id: string
  name: string
  sku: string | null
  oemNo: string | null
  stockQty: number
  criticalStockQty: number
  status: "critical" | "out_of_stock"
}

export async function getCriticalStockItems(workshopId: string, limit = 10): Promise<CriticalStockItem[]> {
  const parts = await prisma.partStockItem.findMany({
    where: {
      workshopId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      sku: true,
      oemNo: true,
      stockQty: true,
      criticalStockQty: true,
    },
    orderBy: { stockQty: "asc" },
  })

  const critical = parts.filter(
    (p) => p.stockQty <= 0 || (p.stockQty > 0 && p.stockQty <= p.criticalStockQty)
  )

  return critical.slice(0, limit).map((p) => ({
    ...p,
    status: (p.stockQty <= 0 ? "out_of_stock" : "critical") as "critical" | "out_of_stock",
  }))
}

export async function getPartById(workshopId: string, partId: string) {
  return prisma.partStockItem.findFirst({
    where: { id: partId, workshopId },
    include: {
      movements: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  })
}

export async function getPartMovements(workshopId: string, partId: string, limit = 50) {
  return prisma.stockMovement.findMany({
    where: { workshopId, partId },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
}

export async function searchParts(workshopId: string, query: string, limit = 20) {
  return prisma.partStockItem.findMany({
    where: {
      workshopId,
      isActive: true,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
        { oemNo: { contains: query, mode: "insensitive" } },
        { brand: { contains: query, mode: "insensitive" } },
        { barcode: { contains: query } },
      ],
    },
    select: {
      id: true,
      name: true,
      sku: true,
      oemNo: true,
      brand: true,
      stockQty: true,
      criticalStockQty: true,
      salePrice: true,
      unit: true,
      isActive: true,
    },
    orderBy: { name: "asc" },
    take: limit,
  })
}

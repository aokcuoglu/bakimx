import { prisma } from "@/lib/db"

export interface SupplierKPIs {
  total: number
  active: number
  passive: number
  withParts: number
}

export async function getSupplierKPIs(workshopId: string): Promise<SupplierKPIs> {
  const suppliers = await prisma.supplier.findMany({
    where: { workshopId },
    select: { id: true, isActive: true },
  })

  const active = suppliers.filter((s) => s.isActive).length
  const passive = suppliers.filter((s) => !s.isActive).length

  const supplierIds = suppliers.map((s) => s.id)
  let withParts = 0
  if (supplierIds.length > 0) {
    const partCounts = await prisma.partStockItem.groupBy({
      by: ["supplierId"],
      where: { workshopId, supplierId: { in: supplierIds } },
      _count: true,
    })
    withParts = partCounts.filter((p) => p._count > 0).length
  }

  return {
    total: suppliers.length,
    active,
    passive,
    withParts,
  }
}

export async function getSupplierById(workshopId: string, supplierId: string) {
  return prisma.supplier.findFirst({
    where: { id: supplierId, workshopId },
    include: {
      parts: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          sku: true,
          oemNo: true,
          stockQty: true,
          criticalStockQty: true,
          salePrice: true,
          unit: true,
          isActive: true,
          category: true,
          brand: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })
}

export interface CriticalSupplierPart {
  id: string
  name: string
  sku: string | null
  oemNo: string | null
  stockQty: number
  criticalStockQty: number
  salePrice: number | null
  unit: string
  isActive: boolean
  status: "critical" | "out_of_stock"
}

export async function getSupplierCriticalParts(workshopId: string, supplierId: string): Promise<CriticalSupplierPart[]> {
  const parts = await prisma.partStockItem.findMany({
    where: { workshopId, supplierId, isActive: true },
    select: {
      id: true,
      name: true,
      sku: true,
      oemNo: true,
      stockQty: true,
      criticalStockQty: true,
      salePrice: true,
      unit: true,
      isActive: true,
    },
    orderBy: { stockQty: "asc" },
  })

  return parts
    .filter((p) => p.stockQty <= 0 || (p.stockQty > 0 && p.stockQty <= p.criticalStockQty))
    .map((p) => ({
      ...p,
      status: (p.stockQty <= 0 ? "out_of_stock" : "critical") as "critical" | "out_of_stock",
    }))
}

export async function getSupplierPartCount(workshopId: string, supplierId: string): Promise<number> {
  return prisma.partStockItem.count({
    where: { workshopId, supplierId },
  })
}

export async function getActiveSuppliersForSelect(workshopId: string) {
  return prisma.supplier.findMany({
    where: { workshopId, isActive: true },
    select: { id: true, name: true, phone: true },
    orderBy: { name: "asc" },
  })
}

export interface CriticalSupplierInfo {
  id: string
  name: string
  phone: string | null
  criticalPartCount: number
}

export async function getCriticalStockSuppliers(workshopId: string, limit = 5): Promise<CriticalSupplierInfo[]> {
  const parts = await prisma.partStockItem.findMany({
    where: {
      workshopId,
      isActive: true,
      supplierId: { not: null },
    },
    select: {
      supplierId: true,
      stockQty: true,
      criticalStockQty: true,
      supplier: { select: { id: true, name: true, phone: true } },
    },
  })

  const criticalBySupplier = new Map<string, CriticalSupplierInfo>()
  for (const p of parts) {
    if (!p.supplierId || !p.supplier) continue
    const isCritical = p.stockQty <= 0 || (p.stockQty > 0 && p.criticalStockQty > 0 && p.stockQty <= p.criticalStockQty)
    if (!isCritical) continue

    const existing = criticalBySupplier.get(p.supplierId)
    if (existing) {
      existing.criticalPartCount++
    } else {
      criticalBySupplier.set(p.supplierId, {
        id: p.supplier.id,
        name: p.supplier.name,
        phone: p.supplier.phone,
        criticalPartCount: 1,
      })
    }
  }

  return Array.from(criticalBySupplier.values())
    .sort((a, b) => b.criticalPartCount - a.criticalPartCount)
    .slice(0, limit)
}
"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { partCreateSchema, partUpdateSchema, stockMovementSchema } from "@/lib/validations/part"
import { getValidationError } from "@/lib/validations/shared"
import { AuditLogAction } from "@/lib/audit"

export async function createPartAction(formData: FormData) {
  const user = await requireAuth()
  const workshopId = user.workshopId

  const raw: Record<string, string> = {}
  const fields = ["name", "sku", "oemNo", "brand", "category", "description", "unit", "stockQty", "criticalStockQty", "purchasePrice", "salePrice", "currency", "supplierName", "supplierPhone", "supplierId", "shelfLocation", "barcode"]
  for (const f of fields) {
    const v = formData.get(f)
    if (v && typeof v === "string") raw[f] = v
  }

  const parsed = partCreateSchema.safeParse(raw)
  if (!parsed.success) return { error: getValidationError(parsed) }

  if (parsed.data.supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: parsed.data.supplierId, workshopId } })
    if (!supplier) return { error: "Geçersiz tedarikçi" }
  }

  const part = await prisma.partStockItem.create({
    data: {
      workshopId,
      name: parsed.data.name,
      sku: parsed.data.sku || null,
      oemNo: parsed.data.oemNo || null,
      brand: parsed.data.brand || null,
      category: parsed.data.category || null,
      description: parsed.data.description || null,
      unit: parsed.data.unit || "adet",
      stockQty: parsed.data.stockQty,
      criticalStockQty: parsed.data.criticalStockQty,
      purchasePrice: parsed.data.purchasePrice ?? null,
      salePrice: parsed.data.salePrice ?? null,
      currency: parsed.data.currency || "TRY",
      supplierName: parsed.data.supplierName || null,
      supplierPhone: parsed.data.supplierPhone || null,
      supplierId: parsed.data.supplierId || null,
      shelfLocation: parsed.data.shelfLocation || null,
      barcode: parsed.data.barcode || null,
    },
  })

  if (parsed.data.stockQty > 0) {
    await prisma.stockMovement.create({
      data: {
        workshopId,
        partId: part.id,
        type: "in",
        quantity: parsed.data.stockQty,
        previousQty: 0,
        newQty: parsed.data.stockQty,
        reason: "İlk stok girişi",
        sourceType: "manual",
        createdByUserId: user.id,
      },
    })
  }

  await AuditLogAction(workshopId, user.id, "PartStockItem", part.id, "part_created")
  revalidatePath("/parts")
  return { success: true, id: part.id }
}

export async function updatePartAction(partId: string, formData: FormData) {
  const user = await requireAuth()
  const workshopId = user.workshopId

  const part = await prisma.partStockItem.findFirst({
    where: { id: partId, workshopId },
  })
  if (!part) return { error: "Parça bulunamadı" }

  const raw: Record<string, string> = {}
  const fields = ["name", "sku", "oemNo", "brand", "category", "description", "unit", "stockQty", "criticalStockQty", "purchasePrice", "salePrice", "currency", "supplierName", "supplierPhone", "supplierId", "shelfLocation", "barcode"]
  for (const f of fields) {
    const v = formData.get(f)
    if (v && typeof v === "string") raw[f] = v
  }

  const parsed = partUpdateSchema.safeParse(raw)
  if (!parsed.success) return { error: getValidationError(parsed) }

  if (parsed.data.supplierId) {
    const supplier = await prisma.supplier.findFirst({ where: { id: parsed.data.supplierId, workshopId } })
    if (!supplier) return { error: "Geçersiz tedarikçi" }
  }

  await prisma.partStockItem.updateMany({
    where: { id: partId, workshopId },
    data: {
      name: parsed.data.name,
      sku: parsed.data.sku || null,
      oemNo: parsed.data.oemNo || null,
      brand: parsed.data.brand || null,
      category: parsed.data.category || null,
      description: parsed.data.description || null,
      unit: parsed.data.unit || "adet",
      stockQty: parsed.data.stockQty,
      criticalStockQty: parsed.data.criticalStockQty,
      purchasePrice: parsed.data.purchasePrice ?? null,
      salePrice: parsed.data.salePrice ?? null,
      currency: parsed.data.currency || "TRY",
      supplierName: parsed.data.supplierName || null,
      supplierPhone: parsed.data.supplierPhone || null,
      supplierId: parsed.data.supplierId || null,
      shelfLocation: parsed.data.shelfLocation || null,
      barcode: parsed.data.barcode || null,
    },
  })

  await AuditLogAction(workshopId, user.id, "PartStockItem", partId, "part_updated")
  revalidatePath(`/parts/${partId}`)
  revalidatePath("/parts")
  return { success: true, id: partId }
}

export async function deactivatePartAction(partId: string) {
  const user = await requireAuth()
  const workshopId = user.workshopId

  const part = await prisma.partStockItem.findFirst({
    where: { id: partId, workshopId },
  })
  if (!part) return { error: "Parça bulunamadı" }

  await prisma.partStockItem.updateMany({
    where: { id: partId, workshopId },
    data: { isActive: false },
  })

  await AuditLogAction(workshopId, user.id, "PartStockItem", partId, "part_deactivated")
  revalidatePath(`/parts/${partId}`)
  revalidatePath("/parts")
  return { success: true }
}

export async function reactivatePartAction(partId: string) {
  const user = await requireAuth()
  const workshopId = user.workshopId

  const part = await prisma.partStockItem.findFirst({
    where: { id: partId, workshopId },
  })
  if (!part) return { error: "Parça bulunamadı" }

  await prisma.partStockItem.updateMany({
    where: { id: partId, workshopId },
    data: { isActive: true },
  })

  await AuditLogAction(workshopId, user.id, "PartStockItem", partId, "part_reactivated")
  revalidatePath(`/parts/${partId}`)
  revalidatePath("/parts")
  return { success: true }
}

export async function deletePartAction(partId: string) {
  const user = await requireAuth()
  const workshopId = user.workshopId

  const part = await prisma.partStockItem.findFirst({
    where: { id: partId, workshopId },
  })
  if (!part) return { error: "Parça bulunamadı" }

  const orderUsage = await prisma.serviceOrderItem.count({
    where: { partId, workshopId },
  })
  const quoteUsage = await prisma.quoteItem.count({
    where: { partId, workshopId },
  })
  if (orderUsage > 0 || quoteUsage > 0) {
    return { error: `Bu parça ${orderUsage} iş emri ve ${quoteUsage} teklifte kullanılmış. Silinemez, pasifleştirin.` }
  }

  const movementCount = await prisma.stockMovement.count({
    where: { partId, workshopId },
  })

  if (movementCount > 0) {
    return { error: "Bu parçaya ait stok hareketleri var. Silinemez, pasifleştirin." }
  }

  await prisma.partStockItem.deleteMany({
    where: { id: partId, workshopId },
  })

  await AuditLogAction(workshopId, user.id, "PartStockItem", partId, "part_deleted")
  revalidatePath("/parts")
  return { success: true }
}

export async function createStockMovementAction(formData: FormData) {
  const user = await requireAuth()
  const workshopId = user.workshopId

  const raw = {
    partId: formData.get("partId") as string,
    type: formData.get("type") as string,
    quantity: formData.get("quantity") as string,
    reason: formData.get("reason") as string,
  }

  const parsed = stockMovementSchema.safeParse(raw)
  if (!parsed.success) return { error: getValidationError(parsed) }

  const part = await prisma.partStockItem.findFirst({
    where: { id: parsed.data.partId, workshopId },
  })
  if (!part) return { error: "Parça bulunamadı" }

  if (!part.isActive) return { error: "Pasif parça için stok hareketi yapılamaz" }

  const previousQty = part.stockQty
  let newQty: number

  if (parsed.data.type === "in") {
    newQty = previousQty + parsed.data.quantity
  } else if (parsed.data.type === "out") {
    if (previousQty < parsed.data.quantity) {
      return { error: `Yetersiz stok. Mevcut: ${previousQty}, Çıkış: ${parsed.data.quantity}` }
    }
    newQty = previousQty - parsed.data.quantity
  } else {
    newQty = parsed.data.quantity
  }

  await prisma.$transaction([
    prisma.partStockItem.updateMany({
      where: { id: parsed.data.partId, workshopId },
      data: { stockQty: newQty },
    }),
    prisma.stockMovement.create({
      data: {
        workshopId,
        partId: parsed.data.partId,
        type: parsed.data.type,
        quantity: parsed.data.quantity,
        previousQty,
        newQty,
        reason: parsed.data.reason || null,
        sourceType: "manual",
        createdByUserId: user.id,
      },
    }),
  ])

  await AuditLogAction(workshopId, user.id, "StockMovement", parsed.data.partId, `stock_${parsed.data.type}`)
  revalidatePath(`/parts/${parsed.data.partId}`)
  revalidatePath("/parts")
  return { success: true }
}

export async function getPartsAction(params: {
  search?: string
  stockStatus?: string
  category?: string
  brand?: string
}) {
  const { search, stockStatus, category, brand } = params
  const { workshopId } = await requireAuth()

  const where: Record<string, unknown> = { workshopId }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { oemNo: { contains: search, mode: "insensitive" } },
      { brand: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
      { supplierName: { contains: search, mode: "insensitive" } },
    ]
  }

  if (category) {
    where.category = category
  }

  if (brand) {
    where.brand = brand
  }

  let parts = await prisma.partStockItem.findMany({
    where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    orderBy: { name: "asc" },
  })

  if (stockStatus && stockStatus !== "all") {
    parts = parts.filter((p) => {
      if (stockStatus === "in_stock") return p.isActive && p.stockQty > p.criticalStockQty
      if (stockStatus === "critical") return p.isActive && p.stockQty > 0 && p.stockQty <= p.criticalStockQty
      if (stockStatus === "out_of_stock") return p.isActive && p.stockQty <= 0
      return true
    })
  }

  return parts
}

export async function getUniqueBrandsAction() {
  const { workshopId } = await requireAuth()
  const parts = await prisma.partStockItem.findMany({
    where: { workshopId, brand: { not: null } },
    select: { brand: true },
    distinct: ["brand"],
  })
  return parts.map((p) => p.brand).filter(Boolean) as string[]
}

export async function getUniqueCategoriesAction() {
  const { workshopId } = await requireAuth()
  const parts = await prisma.partStockItem.findMany({
    where: { workshopId, category: { not: null } },
    select: { category: true },
    distinct: ["category"],
  })
  return parts.map((p) => p.category).filter(Boolean) as string[]
}

export async function searchPartsCatalogAction(query: string) {
  const user = await requireAuth()
  return prisma.partStockItem.findMany({
    where: {
      workshopId: user.workshopId,
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
    take: 20,
  })
}

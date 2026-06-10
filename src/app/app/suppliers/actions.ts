"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { supplierCreateSchema, supplierUpdateSchema, getValidationError } from "@/lib/validation"
import { AuditLogAction } from "@/lib/audit"

export async function createSupplierAction(formData: FormData) {
  const user = await requireAuth()
  const workshopId = user.workshopId

  const raw: Record<string, string> = {}
  const fields = ["name", "contactPerson", "phone", "phone2", "email", "website", "city", "address", "taxNumber", "taxOffice", "category", "paymentTermDays", "averageDeliveryDays", "performanceNote", "internalNote", "isActive"]
  for (const f of fields) {
    const v = formData.get(f)
    if (v != null && typeof v === "string") raw[f] = v
  }

  const parsed = supplierCreateSchema.safeParse(raw)
  if (!parsed.success) return { error: getValidationError(parsed) }

  const supplier = await prisma.supplier.create({
    data: {
      workshopId,
      name: parsed.data.name,
      contactPerson: parsed.data.contactPerson || null,
      phone: parsed.data.phone || null,
      phone2: parsed.data.phone2 || null,
      email: parsed.data.email || null,
      website: parsed.data.website || null,
      city: parsed.data.city || null,
      address: parsed.data.address || null,
      taxNumber: parsed.data.taxNumber || null,
      taxOffice: parsed.data.taxOffice || null,
      category: parsed.data.category || null,
      paymentTermDays: parsed.data.paymentTermDays != null && parsed.data.paymentTermDays !== "" ? Number(parsed.data.paymentTermDays) : null,
      averageDeliveryDays: parsed.data.averageDeliveryDays != null && parsed.data.averageDeliveryDays !== "" ? Number(parsed.data.averageDeliveryDays) : null,
      performanceNote: parsed.data.performanceNote || null,
      internalNote: parsed.data.internalNote || null,
      isActive: parsed.data.isActive ?? true,
    },
  })

  await AuditLogAction(workshopId, user.id, "Supplier", supplier.id, "supplier_created")
  revalidatePath("/app/suppliers")
  return { success: true, id: supplier.id }
}

export async function updateSupplierAction(supplierId: string, formData: FormData) {
  const user = await requireAuth()
  const workshopId = user.workshopId

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, workshopId },
  })
  if (!supplier) return { error: "Tedarikçi bulunamadı" }

  const raw: Record<string, string> = {}
  const fields = ["name", "contactPerson", "phone", "phone2", "email", "website", "city", "address", "taxNumber", "taxOffice", "category", "paymentTermDays", "averageDeliveryDays", "performanceNote", "internalNote", "isActive"]
  for (const f of fields) {
    const v = formData.get(f)
    if (v != null && typeof v === "string") raw[f] = v
  }

  const parsed = supplierUpdateSchema.safeParse(raw)
  if (!parsed.success) return { error: getValidationError(parsed) }

  await prisma.supplier.updateMany({
    where: { id: supplierId, workshopId },
    data: {
      name: parsed.data.name,
      contactPerson: parsed.data.contactPerson || null,
      phone: parsed.data.phone || null,
      phone2: parsed.data.phone2 || null,
      email: parsed.data.email || null,
      website: parsed.data.website || null,
      city: parsed.data.city || null,
      address: parsed.data.address || null,
      taxNumber: parsed.data.taxNumber || null,
      taxOffice: parsed.data.taxOffice || null,
      category: parsed.data.category || null,
      paymentTermDays: parsed.data.paymentTermDays != null && parsed.data.paymentTermDays !== "" ? Number(parsed.data.paymentTermDays) : null,
      averageDeliveryDays: parsed.data.averageDeliveryDays != null && parsed.data.averageDeliveryDays !== "" ? Number(parsed.data.averageDeliveryDays) : null,
      performanceNote: parsed.data.performanceNote || null,
      internalNote: parsed.data.internalNote || null,
      isActive: parsed.data.isActive ?? true,
    },
  })

  await AuditLogAction(workshopId, user.id, "Supplier", supplierId, "supplier_updated")
  revalidatePath(`/app/suppliers/${supplierId}`)
  revalidatePath("/app/suppliers")
  return { success: true, id: supplierId }
}

export async function deactivateSupplierAction(supplierId: string) {
  const user = await requireAuth()
  const workshopId = user.workshopId

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, workshopId },
  })
  if (!supplier) return { error: "Tedarikçi bulunamadı" }

  await prisma.supplier.updateMany({
    where: { id: supplierId, workshopId },
    data: { isActive: false },
  })

  await AuditLogAction(workshopId, user.id, "Supplier", supplierId, "supplier_deactivated")
  revalidatePath(`/app/suppliers/${supplierId}`)
  revalidatePath("/app/suppliers")
  return { success: true }
}

export async function reactivateSupplierAction(supplierId: string) {
  const user = await requireAuth()
  const workshopId = user.workshopId

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, workshopId },
  })
  if (!supplier) return { error: "Tedarikçi bulunamadı" }

  await prisma.supplier.updateMany({
    where: { id: supplierId, workshopId },
    data: { isActive: true },
  })

  await AuditLogAction(workshopId, user.id, "Supplier", supplierId, "supplier_reactivated")
  revalidatePath(`/app/suppliers/${supplierId}`)
  revalidatePath("/app/suppliers")
  return { success: true }
}

export async function deleteSupplierAction(supplierId: string) {
  const user = await requireAuth()
  const workshopId = user.workshopId

  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, workshopId },
  })
  if (!supplier) return { error: "Tedarikçi bulunamadı" }

  const linkedParts = await prisma.partStockItem.count({
    where: { supplierId, workshopId },
  })
  if (linkedParts > 0) {
    return { error: `Bu tedarikçiye ${linkedParts} parça bağlı. Silinemez, pasifleştirin.` }
  }

  await prisma.supplier.deleteMany({
    where: { id: supplierId, workshopId },
  })

  await AuditLogAction(workshopId, user.id, "Supplier", supplierId, "supplier_deleted")
  revalidatePath("/app/suppliers")
  return { success: true }
}
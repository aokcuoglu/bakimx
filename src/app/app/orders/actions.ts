"use server"

import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { serviceOrderItemSchema } from "@/lib/validation"
import { revalidatePath } from "next/cache"

export async function createServiceOrderAction(intakeFormId: string) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: intakeFormId, workshopId: user.workshopId },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }

  const existing = await prisma.serviceOrder.findFirst({
    where: { intakeFormId, workshopId: user.workshopId },
  })
  if (existing) return { error: "Bu kabul için zaten bir servis emri var", id: existing.id }

  const order = await prisma.serviceOrder.create({
    data: {
      workshopId: user.workshopId,
      intakeFormId,
      status: "draft",
    },
  })

  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", order.id, "service_order_created")

  revalidatePath(`/app/intakes/${intakeFormId}`)
  revalidatePath("/app/orders")
  return { success: true, id: order.id }
}

export async function addOrderItemAction(formData: FormData) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const raw = {
    serviceOrderId: formData.get("serviceOrderId") as string,
    type: formData.get("type") as string,
    name: (formData.get("name") as string || "").trim(),
    quantity: formData.get("quantity") as string,
    unitPrice: formData.get("unitPrice") as string,
    totalPrice: formData.get("totalPrice") as string,
    note: formData.get("note") as string,
  }

  const parsed = serviceOrderItemSchema.safeParse({
    type: raw.type,
    name: raw.name,
    quantity: raw.quantity ? Number(raw.quantity) : 1,
    unitPrice: raw.unitPrice ? Number(raw.unitPrice) : undefined,
    totalPrice: raw.totalPrice ? Number(raw.totalPrice) : undefined,
    note: raw.note || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: raw.serviceOrderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "Servis emri bulunamadı" }

  const item = await prisma.serviceOrderItem.create({
    data: {
      workshopId: user.workshopId,
      serviceOrderId: raw.serviceOrderId,
      type: parsed.data.type,
      name: parsed.data.name,
      quantity: parsed.data.quantity,
      unitPrice: parsed.data.unitPrice || null,
      totalPrice: parsed.data.totalPrice || null,
      note: parsed.data.note || null,
    },
  })

  await AuditLogAction(user.workshopId, user.id, "ServiceOrderItem", item.id, "order_item_added")

  revalidatePath(`/app/orders/${raw.serviceOrderId}`)
  return { success: true }
}

export async function removeOrderItemAction(itemId: string, orderId: string) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const item = await prisma.serviceOrderItem.findFirst({
    where: { id: itemId, workshopId: user.workshopId },
  })
  if (!item) return { error: "Kalem bulunamadı" }

  const deleteResult = await prisma.serviceOrderItem.deleteMany({
    where: { id: itemId, workshopId: user.workshopId },
  })
  if (deleteResult.count === 0) return { error: "Kalem bulunamadı" }

  await AuditLogAction(user.workshopId, user.id, "ServiceOrderItem", itemId, "order_item_removed")

  revalidatePath(`/app/orders/${orderId}`)
  return { success: true }
}

export async function updateOrderStatusAction(orderId: string, status: string) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "Servis emri bulunamadı" }

  const updateResult = await prisma.serviceOrder.updateMany({
    where: { id: orderId, workshopId: user.workshopId },
    data: { status: status as import("@prisma/client").OrderStatus },
  })
  if (updateResult.count === 0) return { error: "Servis emri bulunamadı" }

  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", orderId, `order_status_changed_to_${status}`)

  revalidatePath(`/app/orders/${orderId}`)
  revalidatePath("/app/orders")
  return { success: true }
}

export async function getOrdersAction() {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()
  const orders = await prisma.serviceOrder.findMany({
    where: { workshopId: user.workshopId },
    include: {
      intakeForm: { include: { customer: true, vehicle: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
  })
  return orders
}

export async function getOrderAction(orderId: string) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()
  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
    include: {
      intakeForm: { include: { customer: true, vehicle: true, damageMarks: true, photos: true } },
      items: true,
    },
  })
  return order
}

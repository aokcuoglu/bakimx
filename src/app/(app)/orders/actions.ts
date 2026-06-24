"use server"

import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { addTimelineEvent } from "@/lib/intake/timeline"
import { serviceOrderItemSchema } from "@/lib/validations/order"
import { revalidatePath } from "next/cache"
import { createServiceOrderForIntake } from "@/lib/orders/create-service-order"
import { isOrderStatus, isPaymentStatus, canTransitionOrder } from "@/lib/status-transitions"
import type { OrderStatus } from "@prisma/client"
import { notifyWorkOrderCompleted, notifyPaymentReminder } from "@/lib/communications/triggers"
import { syncDeliveryToCalendar } from "@/lib/calendar/sync"
import { z } from "zod/v4"

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

  const order = await prisma.$transaction((tx) =>
    createServiceOrderForIntake(tx, user.workshopId, intakeFormId),
  )

  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", order.id, "service_order_created")

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId,
    eventType: "work_order_created",
    description: "İş emri oluşturuldu",
  })

  revalidatePath(`/intakes/${intakeFormId}`)
  revalidatePath("/orders")
  return { success: true, id: order.id }
}

const orderItemCreateSchema = serviceOrderItemSchema.extend({
  sku: z.string().optional(),
  unit: z.string().optional(),
})

export async function addOrderItemAction(formData: FormData) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const raw = {
    serviceOrderId: formData.get("serviceOrderId") as string,
    type: formData.get("type") as string,
    name: (formData.get("name") as string || "").trim(),
    sku: (formData.get("sku") as string) || "",
    unit: (formData.get("unit") as string) || "",
    quantity: formData.get("quantity") as string,
    unitPrice: formData.get("unitPrice") as string,
    totalPrice: formData.get("totalPrice") as string,
    note: formData.get("note") as string,
  }

  const parsed = orderItemCreateSchema.safeParse({
    type: raw.type,
    name: raw.name,
    sku: raw.sku || undefined,
    unit: raw.unit || undefined,
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
      sku: parsed.data.sku || null,
      unit: parsed.data.unit || null,
      quantity: parsed.data.quantity,
      unitPrice: parsed.data.unitPrice || null,
      totalPrice: parsed.data.totalPrice || null,
      note: parsed.data.note || null,
    },
  })

  await AuditLogAction(user.workshopId, user.id, "ServiceOrderItem", item.id, "order_item_added")

  revalidatePath(`/orders/${raw.serviceOrderId}`)
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

  revalidatePath(`/orders/${orderId}`)
  return { success: true }
}

export async function updateOrderStatusAction(orderId: string, status: string) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  if (!isOrderStatus(status)) return { error: "Geçersiz durum" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "Servis emri bulunamadı" }

  if (!canTransitionOrder(order.status as OrderStatus, status)) {
    return { error: "Bu durum geçişine izin verilmiyor" }
  }

  const updateResult = await prisma.serviceOrder.updateMany({
    where: { id: orderId, workshopId: user.workshopId },
    data: { status },
  })
  if (updateResult.count === 0) return { error: "Servis emri bulunamadı" }

  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", orderId, `order_status_changed_to_${status}`)

  if (status === "ready_for_delivery") {
    try {
      const order = await prisma.serviceOrder.findFirst({
        where: { id: orderId, workshopId: user.workshopId },
        include: { intakeForm: { include: { customer: true, vehicle: true } } },
      })
      if (order?.intakeForm?.customerId) {
        await notifyWorkOrderCompleted(
          user.workshopId,
          order.intakeForm.customerId,
          order.intakeForm.vehicle?.plate || null,
          order.workOrderNo || "BX-???",
          undefined,
          undefined,
          orderId,
        )
      }
    } catch (e) {
      console.error("[notifyWorkOrderCompleted] İş emri tamamlama bildirimi gönderilemedi:", e)
    }
  }

  if (status === "delivered" && order?.paymentStatus === "unpaid") {
    try {
      const fullOrder = await prisma.serviceOrder.findFirst({
        where: { id: orderId, workshopId: user.workshopId },
        include: { intakeForm: { include: { customer: true, vehicle: true } } },
      })
      if (fullOrder?.intakeForm?.customerId && fullOrder.remainingAmount) {
        const { formatTRY } = await import("@/lib/format")
        await notifyPaymentReminder(
          user.workshopId,
          fullOrder.intakeForm.customerId,
          fullOrder.intakeForm.vehicle?.plate || null,
          formatTRY(fullOrder.remainingAmount),
          undefined,
          orderId,
        )
      }
    } catch (e) {
      console.error("[notifyPaymentReminder] Ödeme hatırlatma bildirimi gönderilemedi:", e)
    }
  }

  revalidatePath(`/orders/${orderId}`)
  revalidatePath("/orders")
  return { success: true }
}

export async function updateOrderPaymentStatusAction(orderId: string, paymentStatus: string) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  if (!isPaymentStatus(paymentStatus)) return { error: "Geçersiz ödeme durumu" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "Servis emri bulunamadı" }

  const updateResult = await prisma.serviceOrder.updateMany({
    where: { id: orderId, workshopId: user.workshopId },
    data: { paymentStatus },
  })
  if (updateResult.count === 0) return { error: "Servis emri bulunamadı" }

  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", orderId, `order_payment_changed_to_${paymentStatus}`)

  revalidatePath(`/orders/${orderId}`)
  revalidatePath("/orders")
  return { success: true }
}

const orderMetaSchema = z.object({
  technicianName: z.string().max(120).optional().or(z.literal("")),
  estimatedDeliveryAt: z.string().optional().or(z.literal("")),
  discountAmount: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
})

export async function updateOrderMetaAction(orderId: string, formData: FormData) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const raw = {
    technicianName: formData.get("technicianName") as string,
    estimatedDeliveryAt: formData.get("estimatedDeliveryAt") as string,
    discountAmount: formData.get("discountAmount") as string,
    taxRate: formData.get("taxRate") as string,
    notes: formData.get("notes") as string,
  }

  const parsed = orderMetaSchema.safeParse({
    technicianName: raw.technicianName || "",
    estimatedDeliveryAt: raw.estimatedDeliveryAt || "",
    discountAmount: raw.discountAmount ? Number(raw.discountAmount) : undefined,
    taxRate: raw.taxRate ? Number(raw.taxRate) : undefined,
    notes: raw.notes || "",
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "Servis emri bulunamadı" }

  const estimatedDeliveryAt = parsed.data.estimatedDeliveryAt
    ? new Date(parsed.data.estimatedDeliveryAt)
    : null

  await prisma.serviceOrder.updateMany({
    where: { id: orderId, workshopId: user.workshopId },
    data: {
      technicianName: parsed.data.technicianName || null,
      estimatedDeliveryAt,
      discountAmount: parsed.data.discountAmount ?? null,
      taxRate: parsed.data.taxRate ?? null,
      notes: parsed.data.notes || null,
    },
  })

  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", orderId, "order_meta_updated")

  if (estimatedDeliveryAt) {
    try {
      await syncDeliveryToCalendar(orderId, user.workshopId)
    } catch (e) {
      console.error("[syncDeliveryToCalendar] Teslimat takvim senkronizasyonu başarısız:", e)
    }
  }

  revalidatePath(`/orders/${orderId}`)
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

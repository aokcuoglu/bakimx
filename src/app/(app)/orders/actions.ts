"use server"

import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { addTimelineEvent } from "@/lib/intake/timeline"
import { serviceOrderItemSchema } from "@/lib/validations/order"
import { revalidatePath } from "next/cache"
import { createServiceOrderForIntake } from "@/lib/orders/create-service-order"
import { recalcOrderPayment } from "@/lib/cashbox/recalc"
import { isOrderStatus, isPaymentStatus, canTransitionOrder, isIntakeStatus, canTransitionIntake, isOrderLocked } from "@/lib/status-transitions"
import type { OrderStatus, IntakeStatus } from "@prisma/client"
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

  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", order.id, "service_order_created", undefined, order.id)

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId,
    eventType: "work_order_created",
    description: "İş emri oluşturuldu",
  })

  revalidatePath(`/orders/${order.id}`)
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
  if (isOrderLocked(order.status)) return { error: "Teslim edilmiş veya iptal edilmiş iş emrine kalem eklenemez" }

  // Item prices are integer kuruş. Adding an item changes the order's
  // grandTotal, so re-derive paidAmount/remainingAmount/paymentStatus in the
  // same transaction (server authority).
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.serviceOrderItem.create({
      data: {
        workshopId: user.workshopId,
        serviceOrderId: raw.serviceOrderId,
        type: parsed.data.type,
        name: parsed.data.name,
        sku: parsed.data.sku || null,
        unit: parsed.data.unit || null,
        quantity: parsed.data.quantity,
        unitPrice: parsed.data.unitPrice ?? null,
        totalPrice: parsed.data.totalPrice ?? null,
        note: parsed.data.note || null,
      },
    })
    await recalcOrderPayment(tx, raw.serviceOrderId, user.workshopId)
    return created
  })

  await AuditLogAction(
    user.workshopId,
    user.id,
    "ServiceOrderItem",
    item.id,
    "order_item_added",
    JSON.stringify({
      name: item.name,
      type: item.type,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }),
    raw.serviceOrderId,
  )

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

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "Servis emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: "Teslim edilmiş veya iptal edilmiş iş emrinden kalem silinemez" }

  const deleteResult = await prisma.$transaction(async (tx) => {
    const result = await tx.serviceOrderItem.deleteMany({
      where: { id: itemId, workshopId: user.workshopId },
    })
    if (result.count > 0) {
      await recalcOrderPayment(tx, orderId, user.workshopId)
    }
    return result
  })
  if (deleteResult.count === 0) return { error: "Kalem bulunamadı" }

  await AuditLogAction(
    user.workshopId,
    user.id,
    "ServiceOrderItem",
    itemId,
    "order_item_removed",
    JSON.stringify({ name: item.name, type: item.type, quantity: item.quantity }),
    orderId,
  )

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

  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", orderId, `order_status_changed_to_${status}`, undefined, orderId)

  // Intake + work order are presented as one unified flow (see work-order-detail.tsx's
  // "Sipariş" tab, which drives this action directly); keep the linked intake's
  // status mirrored so it doesn't show stale next to the order status.
  if (isIntakeStatus(status)) {
    const intake = await prisma.vehicleIntakeForm.findFirst({
      where: { id: order.intakeFormId, workshopId: user.workshopId },
    })
    if (intake && canTransitionIntake(intake.status as IntakeStatus, status)) {
      await prisma.vehicleIntakeForm.updateMany({
        where: { id: order.intakeFormId, workshopId: user.workshopId },
        data: { status },
      })
      revalidatePath(`/orders/${orderId}`)
      revalidatePath("/orders")
    }
  }

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

  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", orderId, `order_payment_changed_to_${paymentStatus}`, undefined, orderId)

  revalidatePath(`/orders/${orderId}`)
  revalidatePath("/orders")
  return { success: true }
}

const orderMetaSchema = z.object({
  technicianName: z.string().max(120).optional().or(z.literal("")),
  estimatedDeliveryAt: z.string().optional().or(z.literal("")),
  discountAmount: z.coerce.number().int("İndirim tutarı kuruş (tam sayı) olmalıdır").min(0).optional(), // kuruş
  taxRate: z.coerce.number().int("KDV oranı bps (tam sayı) olmalıdır").min(0).max(10000).optional(), // bps (2000 = %20)
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
  if (isOrderLocked(order.status)) return { error: "Teslim edilmiş veya iptal edilmiş iş emri düzenlenemez" }

  const estimatedDeliveryAt = parsed.data.estimatedDeliveryAt
    ? new Date(parsed.data.estimatedDeliveryAt)
    : null

  // Discount (kuruş) and taxRate (bps) move the order's grandTotal, so re-derive
  // payment fields in the same transaction (server authority).
  await prisma.$transaction(async (tx) => {
    await tx.serviceOrder.updateMany({
      where: { id: orderId, workshopId: user.workshopId },
      data: {
        technicianName: parsed.data.technicianName || null,
        estimatedDeliveryAt,
        discountAmount: parsed.data.discountAmount ?? null,
        taxRate: parsed.data.taxRate ?? null,
        notes: parsed.data.notes || null,
      },
    })
    await recalcOrderPayment(tx, orderId, user.workshopId)
  })

  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", orderId, "order_meta_updated", undefined, orderId)

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

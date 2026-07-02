"use server"

import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { addTimelineEvent } from "@/lib/intake/timeline"
import { revalidatePath } from "next/cache"
import { checklistItemSchema, internalNoteSchema, partsRequestSchema } from "@/lib/validations/technician"
import { canTransitionOrder, isOrderLocked } from "@/lib/status-transitions"
import type { OrderStatus } from "@prisma/client"

const ORDER_LOCKED_ERROR = "Teslim edilmiş veya iptal edilmiş iş emri düzenlenemez"

export async function assignTechnicianAction(orderId: string, technicianId: string) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  const technician = await prisma.technician.findFirst({
    where: { id: technicianId, workshopId: user.workshopId, isActive: true },
  })
  if (!technician) return { error: "Teknisyen bulunamadı" }

  await prisma.serviceOrder.updateMany({
    where: { id: orderId, workshopId: user.workshopId },
    data: {
      assignedTechnicianId: technicianId,
      assignedAt: new Date(),
      technicianName: technician.fullName,
    },
  })

  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", orderId, "technician_assigned", JSON.stringify({ technicianId, technicianName: technician.fullName }))

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: order.intakeFormId,
    eventType: "technician_assigned",
    description: `${technician.fullName} atandı`,
  })

  revalidatePath(`/orders/${orderId}`)
  revalidatePath("/orders")
  revalidatePath("/technician")
  return { success: true }
}

export async function unassignTechnicianAction(orderId: string) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  await prisma.serviceOrder.updateMany({
    where: { id: orderId, workshopId: user.workshopId },
    data: {
      assignedTechnicianId: null,
      assignedAt: null,
    },
  })

  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", orderId, "technician_unassigned")

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: order.intakeFormId,
    eventType: "technician_unassigned",
    description: "Teknisyen ataması kaldırıldı",
  })

  revalidatePath(`/orders/${orderId}`)
  revalidatePath("/orders")
  revalidatePath("/technician")
  return { success: true }
}

export async function startWorkAction(orderId: string) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (!canTransitionOrder(order.status as OrderStatus, "in_progress")) {
    return { error: "Bu durum geçişine izin verilmiyor" }
  }

  await prisma.serviceOrder.updateMany({
    where: { id: orderId, workshopId: user.workshopId },
    data: { status: "in_progress" },
  })

  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", orderId, "work_started")

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: order.intakeFormId,
    eventType: "work_started",
    description: "İşe başlandı",
  })

  revalidatePath(`/technician/orders/${orderId}`)
  revalidatePath("/technician")
  revalidatePath(`/orders/${orderId}`)
  revalidatePath("/orders")
  return { success: true }
}

export async function holdWorkAction(orderId: string) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (!canTransitionOrder(order.status as OrderStatus, "waiting_parts")) {
    return { error: "Bu durum geçişine izin verilmiyor" }
  }

  await prisma.serviceOrder.updateMany({
    where: { id: orderId, workshopId: user.workshopId },
    data: { status: "waiting_parts" },
  })

  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", orderId, "work_on_hold")

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: order.intakeFormId,
    eventType: "work_on_hold",
    description: "İş beklemeye alındı",
  })

  revalidatePath(`/technician/orders/${orderId}`)
  revalidatePath("/technician")
  revalidatePath(`/orders/${orderId}`)
  revalidatePath("/orders")
  return { success: true }
}

export async function completeWorkAction(orderId: string) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (!canTransitionOrder(order.status as OrderStatus, "ready_for_delivery")) {
    return { error: "Bu durum geçişine izin verilmiyor" }
  }

  await prisma.serviceOrder.updateMany({
    where: { id: orderId, workshopId: user.workshopId },
    data: {
      status: "ready_for_delivery",
      completedAt: new Date(),
    },
  })

  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", orderId, "work_completed")

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: order.intakeFormId,
    eventType: "work_completed",
    description: "İş tamamlandı",
  })

  revalidatePath(`/technician/orders/${orderId}`)
  revalidatePath("/technician")
  revalidatePath(`/orders/${orderId}`)
  revalidatePath("/orders")
  return { success: true }
}

export async function addChecklistItemAction(formData: FormData) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const raw = {
    serviceOrderId: formData.get("serviceOrderId") as string,
    category: formData.get("category") as string,
    description: (formData.get("description") as string || "").trim(),
    sortOrder: formData.get("sortOrder") as string,
  }

  const parsed = checklistItemSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: raw.serviceOrderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  await prisma.checklistItem.create({
    data: {
      workshopId: user.workshopId,
      serviceOrderId: raw.serviceOrderId,
      category: parsed.data.category,
      description: parsed.data.description,
      sortOrder: parsed.data.sortOrder,
    },
  })

  await AuditLogAction(user.workshopId, user.id, "ChecklistItem", raw.serviceOrderId, "checklist_item_added")

  revalidatePath(`/technician/orders/${raw.serviceOrderId}`)
  revalidatePath(`/orders/${raw.serviceOrderId}`)
  return { success: true }
}

export async function toggleChecklistItemAction(itemId: string, checked: boolean) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, workshopId: user.workshopId },
  })
  if (!item) return { error: "Kontrol maddesi bulunamadı" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: item.serviceOrderId, workshopId: user.workshopId },
  })
  if (order && isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  await prisma.checklistItem.updateMany({
    where: { id: itemId, workshopId: user.workshopId },
    data: {
      isCompleted: checked,
      completedAt: checked ? new Date() : null,
      completedById: checked ? null : null,
    },
  })

  revalidatePath(`/technician/orders/${item.serviceOrderId}`)
  revalidatePath(`/orders/${item.serviceOrderId}`)
  return { success: true }
}

export async function updateChecklistNoteAction(itemId: string, note: string) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, workshopId: user.workshopId },
  })
  if (!item) return { error: "Kontrol maddesi bulunamadı" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: item.serviceOrderId, workshopId: user.workshopId },
  })
  if (order && isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  await prisma.checklistItem.updateMany({
    where: { id: itemId, workshopId: user.workshopId },
    data: { note: note || null },
  })

  revalidatePath(`/technician/orders/${item.serviceOrderId}`)
  return { success: true }
}

export async function deleteChecklistItemAction(itemId: string) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, workshopId: user.workshopId },
  })
  if (!item) return { error: "Kontrol maddesi bulunamadı" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: item.serviceOrderId, workshopId: user.workshopId },
  })
  if (order && isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  await prisma.checklistItem.deleteMany({
    where: { id: itemId, workshopId: user.workshopId },
  })

  revalidatePath(`/technician/orders/${item.serviceOrderId}`)
  revalidatePath(`/orders/${item.serviceOrderId}`)
  return { success: true }
}

export async function addInternalNoteAction(formData: FormData) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const raw = {
    serviceOrderId: formData.get("serviceOrderId") as string,
    content: (formData.get("content") as string || "").trim(),
  }

  const parsed = internalNoteSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: raw.serviceOrderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  await prisma.internalNote.create({
    data: {
      workshopId: user.workshopId,
      serviceOrderId: raw.serviceOrderId,
      content: parsed.data.content,
    },
  })

  revalidatePath(`/technician/orders/${raw.serviceOrderId}`)
  revalidatePath(`/orders/${raw.serviceOrderId}`)
  return { success: true }
}

export async function deleteInternalNoteAction(noteId: string) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const note = await prisma.internalNote.findFirst({
    where: { id: noteId, workshopId: user.workshopId },
  })
  if (!note) return { error: "Not bulunamadı" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: note.serviceOrderId, workshopId: user.workshopId },
  })
  if (order && isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  await prisma.internalNote.deleteMany({
    where: { id: noteId, workshopId: user.workshopId },
  })

  revalidatePath(`/technician/orders/${note.serviceOrderId}`)
  revalidatePath(`/orders/${note.serviceOrderId}`)
  return { success: true }
}

export async function createPartsRequestAction(formData: FormData) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const raw = {
    serviceOrderId: formData.get("serviceOrderId") as string,
    partName: (formData.get("partName") as string || "").trim(),
    partSku: (formData.get("partSku") as string) || "",
    quantity: formData.get("quantity") as string,
    note: (formData.get("note") as string) || "",
  }

  const parsed = partsRequestSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: raw.serviceOrderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  await prisma.partsRequest.create({
    data: {
      workshopId: user.workshopId,
      serviceOrderId: raw.serviceOrderId,
      partName: parsed.data.partName,
      partSku: parsed.data.partSku || null,
      quantity: parsed.data.quantity,
      note: parsed.data.note || null,
      status: "requested",
    },
  })

  await AuditLogAction(user.workshopId, user.id, "PartsRequest", raw.serviceOrderId, "parts_requested")

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: order.intakeFormId,
    eventType: "parts_requested",
    description: `Parça talep edildi: ${parsed.data.partName}`,
  })

  revalidatePath(`/technician/orders/${raw.serviceOrderId}`)
  revalidatePath(`/orders/${raw.serviceOrderId}`)
  return { success: true }
}

export async function updatePartsRequestStatusAction(requestId: string, status: string) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const request = await prisma.partsRequest.findFirst({
    where: { id: requestId, workshopId: user.workshopId },
  })
  if (!request) return { error: "Parça talebi bulunamadı" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: request.serviceOrderId, workshopId: user.workshopId },
  })
  if (order && isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  await prisma.partsRequest.updateMany({
    where: { id: requestId, workshopId: user.workshopId },
    data: { status: status as import("@prisma/client").PartsRequestStatus },
  })

  const statusLabels: Record<string, string> = {
    requested: "Talep Edildi",
    prepared: "Hazırlandı",
    delivered: "Teslim Edildi",
  }

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: (await prisma.serviceOrder.findFirst({ where: { id: request.serviceOrderId } }))!.intakeFormId,
    eventType: "parts_request_updated",
    description: `Parça durumu güncellendi: ${request.partName} → ${statusLabels[status] || status}`,
  })

  revalidatePath(`/technician/orders/${request.serviceOrderId}`)
  revalidatePath(`/orders/${request.serviceOrderId}`)
  return { success: true }
}

export async function startLaborSessionAction(orderId: string) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  const activeSession = await prisma.laborSession.findFirst({
    where: { serviceOrderId: orderId, workshopId: user.workshopId, endTime: null },
  })
  if (activeSession) return { error: "Zaten aktif bir işçilik oturumu var" }

  await prisma.laborSession.create({
    data: {
      workshopId: user.workshopId,
      serviceOrderId: orderId,
      startTime: new Date(),
    },
  })

  revalidatePath(`/technician/orders/${orderId}`)
  revalidatePath(`/orders/${orderId}`)
  return { success: true }
}

export async function stopLaborSessionAction(orderId: string) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const activeSession = await prisma.laborSession.findFirst({
    where: { serviceOrderId: orderId, workshopId: user.workshopId, endTime: null },
  })
  if (!activeSession) return { error: "Aktif işçilik oturumu bulunamadı" }

  const now = new Date()
  const durationMs = now.getTime() - activeSession.startTime.getTime()
  const durationMinutes = Math.round(durationMs / 60000)

  await prisma.laborSession.updateMany({
    where: { id: activeSession.id, workshopId: user.workshopId },
    data: {
      endTime: now,
      durationMinutes,
    },
  })

  revalidatePath(`/technician/orders/${orderId}`)
  revalidatePath(`/orders/${orderId}`)
  return { success: true, durationMinutes }
}

export async function createTechnicianAction(formData: FormData) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const fullName = (formData.get("fullName") as string || "").trim()
  const phone = (formData.get("phone") as string || "").trim()
  const role = (formData.get("role") as string || "usta").trim()

  if (!fullName) return { error: "Ad soyad zorunludur" }
  if (!phone) return { error: "Telefon zorunludur" }

  const validRoles = ["usta", "teknisyen", "servis_danismani", "yonetici"]
  if (!validRoles.includes(role)) return { error: "Geçersiz rol" }

  const technician = await prisma.technician.create({
    data: {
      workshopId: user.workshopId,
      fullName,
      phone,
      role: role as import("@prisma/client").TechnicianRole,
    },
  })

  await AuditLogAction(user.workshopId, user.id, "Technician", technician.id, "technician_created")

  revalidatePath("/workshop")
  revalidatePath("/technician")
  return { success: true, id: technician.id }
}

export async function toggleTechnicianActiveAction(technicianId: string) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const technician = await prisma.technician.findFirst({
    where: { id: technicianId, workshopId: user.workshopId },
  })
  if (!technician) return { error: "Teknisyen bulunamadı" }

  await prisma.technician.updateMany({
    where: { id: technicianId, workshopId: user.workshopId },
    data: { isActive: !technician.isActive },
  })

  revalidatePath("/workshop")
  revalidatePath("/technician")
  return { success: true }
}
"use server"

import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { addTimelineEvent } from "@/lib/intake/timeline"
import { revalidatePath } from "next/cache"
import {
  checklistItemSchema,
  internalNoteSchema,
  laborSessionEditSchema,
  laborSessionNoteSchema,
  partsRequestCancelSchema,
  partsRequestEditSchema,
  partsRequestSchema,
} from "@/lib/validations/technician"
import { partsRequestToItemFields, partsRequestTypeLabel } from "@/lib/orders/parts-request-item"
import { canTransitionOrder, isOrderLocked } from "@/lib/status-transitions"
import { seedChecklistFromTemplate } from "@/lib/technician/checklist-seed"
import { ACTIVE_CHECKLIST_ITEM } from "@/lib/technician/checklist-visibility"
import {
  countIncompleteItems,
  completeWorkBlockMessage,
} from "@/lib/technician/gates"
import type { OrderStatus } from "@prisma/client"

const ORDER_LOCKED_ERROR = "Teslim edilmiş veya iptal edilmiş iş emri düzenlenemez"

/** Talebin fiziksel teslimat akışı; `cancelled` bu akışın dışında bir karardır. */
const PHYSICAL_PARTS_REQUEST_STATUSES: readonly string[] = ["requested", "prepared", "delivered"]

const PARTS_REQUEST_CANCELLED_ERROR = "Bu talep iptal edilmiş; önce iptali geri alın"
const PARTS_REQUEST_CONVERTED_ERROR = "Bu talep kaleme eklendi; değişiklik iş emri kalemi üzerinden yapılır"

export async function assignTechnicianAction(orderId: string, technicianId: string) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.edit")

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  const technician = await prisma.technician.findFirst({
    where: { id: technicianId, workshopId: user.workshopId, isActive: true },
  })
  if (!technician) return { error: "Teknisyen bulunamadı" }

  const seededCount = await prisma.$transaction(async (tx) => {
    await tx.serviceOrder.updateMany({
      where: { id: orderId, workshopId: user.workshopId },
      data: {
        assignedTechnicianId: technicianId,
        assignedAt: new Date(),
        technicianName: technician.fullName,
      },
    })
    // Jenerik kontrol maddeleri atama anında oluşur; idempotent olduğu için
    // yeniden atamada tekrar eklenmez.
    return seedChecklistFromTemplate(tx, user.workshopId, orderId)
  })

  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", orderId, "technician_assigned", JSON.stringify({ technicianId, technicianName: technician.fullName, checklistSeeded: seededCount }))

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: order.intakeFormId,
    eventType: "technician_assigned",
    description: `${technician.fullName} atandı`,
  })

  revalidatePath(`/orders/${orderId}`)
  revalidatePath("/orders")
  revalidatePath("/technician")
  revalidatePath(`/technician/orders/${orderId}`)
  return { success: true }
}

export async function unassignTechnicianAction(orderId: string) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.edit")

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
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.status")

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (!canTransitionOrder(order.status as OrderStatus, "in_progress")) {
    return { error: "Bu durum geçişine izin verilmiyor" }
  }

  // Kontrol listesi burada BİLİNÇLİ olarak okunmuyor: eksik kontrol maddesi
  // artık tamire başlamayı engellemiyor (BAK-24, gerekçe `gates.ts` başında).
  await prisma.serviceOrder.updateMany({
    where: { id: orderId, workshopId: user.workshopId },
    data: { status: "in_progress" },
  })

  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", orderId, "work_started")

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: order.intakeFormId,
    eventType: "work_started",
    description: "Tamire başlandı",
  })

  revalidatePath(`/technician/orders/${orderId}`)
  revalidatePath("/technician")
  revalidatePath(`/orders/${orderId}`)
  revalidatePath("/orders")
  return { success: true }
}

export async function holdWorkAction(orderId: string) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.status")

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
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.status")

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (!canTransitionOrder(order.status as OrderStatus, "ready_for_delivery")) {
    return { error: "Bu durum geçişine izin verilmiyor" }
  }

  // Tek kapı iş kalemleri: eksik kontrol maddesi iş emrini kapattırmaz
  // (BAK-24, gerekçe `gates.ts` başında).
  const items = await prisma.serviceOrderItem.findMany({
    where: { serviceOrderId: orderId, workshopId: user.workshopId },
    select: { completedAt: true },
  })
  const completeBlock = completeWorkBlockMessage(countIncompleteItems(items))
  if (completeBlock) return { error: completeBlock }

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
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.edit")

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
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.edit")

  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, workshopId: user.workshopId, ...ACTIVE_CHECKLIST_ITEM },
  })
  if (!item) return { error: "Kontrol maddesi bulunamadı" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: item.serviceOrderId, workshopId: user.workshopId },
    select: { status: true, assignedTechnicianId: true },
  })
  if (order && isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  await prisma.checklistItem.updateMany({
    where: { id: itemId, workshopId: user.workshopId },
    data: {
      isCompleted: checked,
      completedAt: checked ? new Date() : null,
      completedById: checked ? (order?.assignedTechnicianId ?? null) : null,
    },
  })

  revalidatePath(`/technician/orders/${item.serviceOrderId}`)
  revalidatePath(`/orders/${item.serviceOrderId}`)
  return { success: true }
}

/**
 * Bir aşamanın (Kontrol / Onarım / Teslim) kalan maddelerini tek dokunuşla
 * işaretler.
 *
 * Kasıtlı olarak AŞAMA BAZLI, liste geneli değil: teslim kontrolleri araç daha
 * tamir edilmeden işaretlenmemeli, aşamalar farklı zamanlarda bitiyor.
 * Yalnız `isCompleted: false` satırlara dokunur — önceden işaretlenenlerin
 * zaman damgası ve "kim tamamladı" bilgisi korunur.
 */
export async function completeAllChecklistItemsAction(orderId: string, category: string) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.edit")

  const parsedCategory = checklistItemSchema.shape.category.safeParse(category)
  if (!parsedCategory.success) return { error: "Geçerli bir kategori seçiniz" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
    select: { id: true, status: true, assignedTechnicianId: true },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  const { count } = await prisma.checklistItem.updateMany({
    where: {
      serviceOrderId: order.id,
      workshopId: user.workshopId,
      category: parsedCategory.data,
      isCompleted: false,
      ...ACTIVE_CHECKLIST_ITEM,
    },
    data: {
      isCompleted: true,
      completedAt: new Date(),
      completedById: order.assignedTechnicianId,
    },
  })

  if (count > 0) {
    await AuditLogAction(
      user.workshopId,
      user.id,
      "ServiceOrder",
      order.id,
      "checklist_items_completed_all",
      JSON.stringify({ orderId: order.id, category: parsedCategory.data, count })
    )
  }

  revalidatePath(`/technician/orders/${order.id}`)
  revalidatePath(`/orders/${order.id}`)
  return { success: true, count }
}

/** Bir kontrol listesi aşamasındaki işaretleri tek seferde kaldırır. */
export async function uncompleteAllChecklistItemsAction(orderId: string, category: string) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.edit")

  const parsedCategory = checklistItemSchema.shape.category.safeParse(category)
  if (!parsedCategory.success) return { error: "Geçerli bir kategori seçiniz" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
    select: { id: true, status: true },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  const { count } = await prisma.checklistItem.updateMany({
    where: {
      serviceOrderId: order.id,
      workshopId: user.workshopId,
      category: parsedCategory.data,
      isCompleted: true,
      ...ACTIVE_CHECKLIST_ITEM,
    },
    data: { isCompleted: false, completedAt: null, completedById: null },
  })

  if (count > 0) {
    await AuditLogAction(
      user.workshopId,
      user.id,
      "ServiceOrder",
      order.id,
      "checklist_items_uncompleted_all",
      JSON.stringify({ orderId: order.id, category: parsedCategory.data, count })
    )
  }

  revalidatePath(`/technician/orders/${order.id}`)
  revalidatePath(`/orders/${order.id}`)
  return { success: true, count }
}

export async function updateChecklistNoteAction(itemId: string, note: string) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.edit")

  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, workshopId: user.workshopId, ...ACTIVE_CHECKLIST_ITEM },
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

/**
 * Kontrol maddesini bu iş emrinden çıkarır — şablon maddeleri dahil.
 *
 * Silme SOFT ve İŞ EMRİNE ÖZELdir: satır `deletedAt` ile mezar taşı olarak
 * kalır, böylece seed maddeyi geri getirmez (`templateKey` hâlâ "var" sayılır)
 * ve "geri al" mümkün olur. Şablonun kendisi değişmez; sonraki iş emirleri
 * silinenler dahil tüm maddeleri almaya devam eder.
 *
 * Zorunlu (şablon) maddeler eskiden hiç silinemiyordu; atölyeler kullanmadıkları
 * maddeleri listede taşımak zorunda kalıyordu. Artık silinebiliyorlar — kapı
 * hesabı silinen maddeyi saymaz, yani madde kalmayan bir kategori kapıyı açar.
 * Bu bilinçli: maddeyi listeden çıkaran, o kontrolü istemediğini söylüyor.
 */
export async function deleteChecklistItemAction(itemId: string) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.edit")

  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, workshopId: user.workshopId },
  })
  if (!item) return { error: "Kontrol maddesi bulunamadı" }
  // Zaten silinmiş: çift dokunuş hata göstermesin, silinme anı korunsun.
  if (item.deletedAt) return { success: true }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: item.serviceOrderId, workshopId: user.workshopId },
  })
  if (order && isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  await prisma.checklistItem.updateMany({
    where: { id: itemId, workshopId: user.workshopId, ...ACTIVE_CHECKLIST_ITEM },
    data: { deletedAt: new Date(), deletedById: user.id },
  })

  await AuditLogAction(
    user.workshopId,
    user.id,
    "ChecklistItem",
    item.serviceOrderId,
    "checklist_item_removed",
    JSON.stringify({ itemId, description: item.description, templateKey: item.templateKey })
  )

  revalidatePath(`/technician/orders/${item.serviceOrderId}`)
  revalidatePath(`/orders/${item.serviceOrderId}`)
  return { success: true }
}

/** Yanlışlıkla silinen maddeyi bu iş emrine geri alır (işaretli/notlu hâliyle). */
export async function restoreChecklistItemAction(itemId: string) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.edit")

  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, workshopId: user.workshopId },
  })
  if (!item) return { error: "Kontrol maddesi bulunamadı" }
  if (!item.deletedAt) return { success: true }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: item.serviceOrderId, workshopId: user.workshopId },
  })
  if (order && isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  await prisma.checklistItem.updateMany({
    where: { id: itemId, workshopId: user.workshopId },
    data: { deletedAt: null, deletedById: null },
  })

  await AuditLogAction(
    user.workshopId,
    user.id,
    "ChecklistItem",
    item.serviceOrderId,
    "checklist_item_restored",
    JSON.stringify({ itemId, description: item.description, templateKey: item.templateKey })
  )

  revalidatePath(`/technician/orders/${item.serviceOrderId}`)
  revalidatePath(`/orders/${item.serviceOrderId}`)
  return { success: true }
}

export async function addInternalNoteAction(formData: FormData) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.edit")

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
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.edit")

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
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("parts.purchase")

  const raw = {
    serviceOrderId: formData.get("serviceOrderId") as string,
    type: (formData.get("type") as string) || "part",
    partName: (formData.get("partName") as string || "").trim(),
    partSku: (formData.get("partSku") as string) || "",
    quantity: (formData.get("quantity") as string) ?? undefined,
    note: (formData.get("note") as string) || "",
    brand: (formData.get("brand") as string) || "",
    tecdocArticleId: (formData.get("tecdocArticleId") as string) || "",
    supplierName: (formData.get("supplierName") as string) || "",
    estimatedPrice: (formData.get("estimatedPrice") as string) || "",
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

  // Alan temizliği zod transform'unda yapıldı (tipe göre katalog VEYA tutar
  // alanları boşlanır) — burada parsed.data olduğu gibi yazılır.
  await prisma.partsRequest.create({
    data: {
      workshopId: user.workshopId,
      serviceOrderId: raw.serviceOrderId,
      type: parsed.data.type,
      partName: parsed.data.partName,
      partSku: parsed.data.partSku || null,
      quantity: parsed.data.quantity,
      note: parsed.data.note || null,
      brand: parsed.data.brand || null,
      tecdocArticleId: parsed.data.tecdocArticleId ?? null,
      supplierName: parsed.data.supplierName || null,
      estimatedPriceKurus: parsed.data.estimatedPriceKurus ?? null,
      status: "requested",
    },
  })

  await AuditLogAction(user.workshopId, user.id, "PartsRequest", raw.serviceOrderId, "parts_requested")

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: order.intakeFormId,
    eventType: "parts_requested",
    // MÜŞTERİYE AÇIK olay (parts_requested passport denylist'inde değil) —
    // tedarikçi ve tahmini tutar bilerek yazılmaz, yalnız ne istendiği yazılır.
    description: `${partsRequestTypeLabel(parsed.data.type)} talep edildi: ${parsed.data.partName}`,
  })

  revalidatePath(`/technician/orders/${raw.serviceOrderId}`)
  revalidatePath(`/orders/${raw.serviceOrderId}`)
  return { success: true }
}

/**
 * Talebin FİZİKSEL akışını ilerletir (requested→prepared→delivered).
 *
 * `cancelled` buradan yazılamaz: iptal ayrı bir karardır, gerekçesiyle birlikte
 * `cancelPartsRequestAction` üzerinden geçer. İptal edilmiş talep de bu akışta
 * ilerletilemez — önce `reopenPartsRequestAction` ile geri alınması gerekir.
 */
export async function updatePartsRequestStatusAction(requestId: string, status: string) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("parts.purchase")

  if (!PHYSICAL_PARTS_REQUEST_STATUSES.includes(status)) return { error: "Geçersiz talep durumu" }

  const request = await prisma.partsRequest.findFirst({
    where: { id: requestId, workshopId: user.workshopId },
  })
  if (!request) return { error: "Parça talebi bulunamadı" }
  if (request.status === "cancelled") return { error: PARTS_REQUEST_CANCELLED_ERROR }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: request.serviceOrderId, workshopId: user.workshopId },
  })
  if (order && isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  await prisma.partsRequest.updateMany({
    where: { id: requestId, workshopId: user.workshopId },
    data: { status: status as import("@prisma/client").PartsRequestStatus },
  })

  // "requested" bu action'ın giriş durumu, bir karar değil — yalnız fiili karar
  // anları (hazır/teslim) denetim kaydına düşer. Teknisyen bildirim yoklaması
  // (BAK-109) bu kaydı okur; önceden yalnız `cancelled` ve `converted` için
  // AuditLog satırı vardı, bu iki geçiş sessiz kalıyordu.
  if (status === "prepared" || status === "delivered") {
    await AuditLogAction(
      user.workshopId,
      user.id,
      "PartsRequest",
      requestId,
      `parts_request_${status}`,
      JSON.stringify({ partName: request.partName }),
      request.serviceOrderId,
    )
  }

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
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.status")

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  const activeSession = await prisma.laborSession.findFirst({
    where: { serviceOrderId: orderId, workshopId: user.workshopId, endTime: null },
  })
  if (activeSession) return { error: "Zaten aktif bir işçilik oturumu var" }

  const created = await prisma.laborSession.create({
    data: {
      workshopId: user.workshopId,
      serviceOrderId: orderId,
      startTime: new Date(),
    },
  })

  // BAK-138: Sayaç olayları da denetim kaydına düşer. Gerekçe: kayıt sonradan
  // elle düzeltilebiliyor; "saat sayaçtan mı geldi, elle mi girildi" sorusunun
  // cevabı yalnız bu satırlar varsa kalıcı olur.
  await AuditLogAction(
    user.workshopId,
    user.id,
    "LaborSession",
    created.id,
    "labor_session_started",
    JSON.stringify({ startTime: created.startTime.toISOString() }),
    orderId,
  )

  revalidatePath(`/technician/orders/${orderId}`)
  revalidatePath(`/orders/${orderId}`)
  return { success: true }
}

/**
 * Sayacı durdurur. `note` opsiyoneldir — teknisyen "bu sürede ne yaptım"ı
 * bitirirken yazabilir, boş bırakıp sonradan da ekleyebilir (BAK-138).
 */
export async function stopLaborSessionAction(orderId: string, note?: string) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.status")

  const parsed = laborSessionNoteSchema.safeParse({ note: note ?? "" })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Geçersiz açıklama" }

  const activeSession = await prisma.laborSession.findFirst({
    where: { serviceOrderId: orderId, workshopId: user.workshopId, endTime: null },
  })
  if (!activeSession) return { error: "Aktif işçilik oturumu bulunamadı" }

  const now = new Date()
  const durationMs = now.getTime() - activeSession.startTime.getTime()
  const durationMinutes = Math.round(durationMs / 60000)
  const cleanNote = parsed.data.note?.trim() || null

  // Koşullu yazma (`endTime: null`): iki sekmeden aynı anda "Durdur" basılırsa
  // ikincisi kaybeder ve bitmiş bir kaydın saati sessizce ezilmez.
  const stopped = await prisma.laborSession.updateMany({
    where: { id: activeSession.id, workshopId: user.workshopId, endTime: null },
    data: {
      endTime: now,
      durationMinutes,
      // Not YALNIZ doluysa yazılır: boş gönderim var olan bir notu silmesin.
      ...(cleanNote ? { note: cleanNote } : {}),
    },
  })
  if (stopped.count === 0) return { error: "İşçilik bu sırada durduruldu, sayfayı yenileyin" }

  await AuditLogAction(
    user.workshopId,
    user.id,
    "LaborSession",
    activeSession.id,
    "labor_session_stopped",
    JSON.stringify({
      startTime: activeSession.startTime.toISOString(),
      endTime: now.toISOString(),
      durationMinutes,
      note: cleanNote,
    }),
    orderId,
  )

  revalidatePath(`/technician/orders/${orderId}`)
  revalidatePath(`/orders/${orderId}`)
  return { success: true, durationMinutes }
}

/**
 * Bitmiş bir işçilik süresi kaydının saatlerini ve açıklamasını elle düzeltir
 * (BAK-138).
 *
 * YETKİ — `order.edit`: sayacı başlatıp durdurmak `order.status` iken, oluşmuş
 * bir KAYDI geriye dönük değiştirmek iş emri verisini düzenlemektir. Pratikte
 * ikisini de usta/servis müdürü/yönetici taşır, çırak taşımaz. Kaydı yalnız
 * "sahibi" düzeltsin kuralı bilerek konmadı: `LaborSession.technicianId` bu
 * akışta hiç doldurulmuyor (sayacı kim başlattı bilgisi kayıtta yok), yani
 * sahiplik kontrolü bugün her kaydı kilitlerdi.
 *
 * DEVAM EDEN kayıt düzenlenemez: bitiş saati henüz yok, "aralık" diye bir şey
 * yok. Önce durdurulur, sonra düzeltilir.
 *
 * `durationMinutes` her zaman aralıktan yeniden türetilir — kullanıcıdan süre
 * alınmaz, böylece saatler ile süre birbirinden ayrı düşemez.
 */
export async function updateLaborSessionAction(sessionId: string, formData: FormData) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.edit")

  const parsed = laborSessionEditSchema.safeParse({
    startTime: (formData.get("startTime") as string) || "",
    endTime: (formData.get("endTime") as string) || "",
    note: (formData.get("note") as string) || "",
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }

  const session = await prisma.laborSession.findFirst({
    where: { id: sessionId, workshopId: user.workshopId },
  })
  if (!session) return { error: "İşçilik kaydı bulunamadı" }
  if (!session.endTime) return { error: "Devam eden işçilik düzenlenemez; önce durdurun" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: session.serviceOrderId, workshopId: user.workshopId },
    select: { id: true, status: true },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  const { startTime, endTime } = parsed.data
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)
  const note = parsed.data.note?.trim() || null

  const updated = await prisma.laborSession.updateMany({
    where: { id: sessionId, workshopId: user.workshopId, endTime: { not: null } },
    data: {
      startTime,
      endTime,
      durationMinutes,
      note,
      editedAt: new Date(),
      editedByUserId: user.id,
    },
  })
  if (updated.count === 0) return { error: "Kayıt bu sırada değişti, sayfayı yenileyin" }

  await AuditLogAction(
    user.workshopId,
    user.id,
    "LaborSession",
    sessionId,
    "labor_session_edited",
    JSON.stringify({
      before: {
        startTime: session.startTime.toISOString(),
        endTime: session.endTime.toISOString(),
        durationMinutes: session.durationMinutes,
        note: session.note,
      },
      after: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        durationMinutes,
        note,
      },
    }),
    session.serviceOrderId,
  )

  revalidatePath(`/technician/orders/${session.serviceOrderId}`)
  revalidatePath(`/orders/${session.serviceOrderId}`)
  return { success: true }
}

export async function createTechnicianAction(formData: FormData) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("team.manage")

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

  revalidatePath("/settings")
  revalidatePath("/technician")
  return { success: true, id: technician.id }
}

export async function toggleTechnicianActiveAction(technicianId: string) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("team.manage")

  const technician = await prisma.technician.findFirst({
    where: { id: technicianId, workshopId: user.workshopId },
  })
  if (!technician) return { error: "Teknisyen bulunamadı" }

  await prisma.technician.updateMany({
    where: { id: technicianId, workshopId: user.workshopId },
    data: { isActive: !technician.isActive },
  })

  revalidatePath("/settings")
  revalidatePath("/technician")
  return { success: true }
}

/**
 * İş emri kalemini (parça/işçilik) "yapıldı" işaretler veya işareti kaldırır.
 *
 * Attribution: Technician↔User ilişkisi olmadığı için `completedById` iş emrinin
 * ATANMIŞ ustasıdır; eylemi yapan gerçek kullanıcı AuditLog'a yazılır.
 */
export async function toggleOrderItemCompletedAction(itemId: string, done: boolean) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.edit")

  const item = await prisma.serviceOrderItem.findFirst({
    where: { id: itemId, workshopId: user.workshopId },
    select: { id: true, name: true, serviceOrderId: true },
  })
  if (!item) return { error: "İş kalemi bulunamadı" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: item.serviceOrderId, workshopId: user.workshopId },
    select: { id: true, status: true, assignedTechnicianId: true },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  await prisma.serviceOrderItem.updateMany({
    where: { id: itemId, workshopId: user.workshopId },
    data: {
      completedAt: done ? new Date() : null,
      completedById: done ? order.assignedTechnicianId : null,
    },
  })

  await AuditLogAction(
    user.workshopId,
    user.id,
    "ServiceOrderItem",
    itemId,
    done ? "order_item_completed" : "order_item_uncompleted",
    JSON.stringify({ orderId: item.serviceOrderId, name: item.name })
  )

  revalidatePath(`/technician/orders/${item.serviceOrderId}`)
  revalidatePath(`/orders/${item.serviceOrderId}`)
  return { success: true }
}

/**
 * İş emrindeki tamamlanmamış TÜM kalemleri tek dokunuşla "yapıldı" işaretler
 * (BAK-21). On iki kalemi tek tek işaretlemek mobilde iş emrini kapatmanın en
 * yavaş adımıydı.
 *
 * Yalnız `completedAt: null` satırlara dokunur: daha önce işaretlenmiş
 * kalemlerin zaman damgası ve kim tamamladı bilgisi korunur, aksi hâlde toplu
 * işlem gerçek tamamlama saatlerini eziyordu.
 *
 * Attribution `toggleOrderItemCompletedAction` ile aynı: `completedById` iş
 * emrinin atanmış ustası, eylemi yapan kullanıcı AuditLog'a yazılır.
 */
export async function completeAllOrderItemsAction(orderId: string) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.edit")

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
    select: { id: true, status: true, assignedTechnicianId: true },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  const { count } = await prisma.serviceOrderItem.updateMany({
    where: { serviceOrderId: order.id, workshopId: user.workshopId, completedAt: null },
    data: { completedAt: new Date(), completedById: order.assignedTechnicianId },
  })

  if (count > 0) {
    await AuditLogAction(
      user.workshopId,
      user.id,
      "ServiceOrder",
      order.id,
      "order_items_completed_all",
      JSON.stringify({ orderId: order.id, count })
    )
  }

  revalidatePath(`/technician/orders/${order.id}`)
  revalidatePath(`/orders/${order.id}`)
  return { success: true, count }
}

/** İş emrindeki tüm tamamlanmış kalemleri tek seferde tekrar açık duruma alır. */
export async function uncompleteAllOrderItemsAction(orderId: string) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("order.edit")

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
    select: { id: true, status: true },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  const { count } = await prisma.serviceOrderItem.updateMany({
    where: { serviceOrderId: order.id, workshopId: user.workshopId, completedAt: { not: null } },
    data: { completedAt: null, completedById: null },
  })

  if (count > 0) {
    await AuditLogAction(
      user.workshopId,
      user.id,
      "ServiceOrder",
      order.id,
      "order_items_uncompleted_all",
      JSON.stringify({ orderId: order.id, count })
    )
  }

  revalidatePath(`/technician/orders/${order.id}`)
  revalidatePath(`/orders/${order.id}`)
  return { success: true, count }
}

/**
 * Teknisyenin parça talebini iş emri kalemine çevirir (ofis aksiyonu).
 * Fiyat alanları boş bırakılır — ofis kalem satırında girer.
 *
 * `convertedAt` bu dönüşümün tek gerçek kaynağıdır — `status` teknisyen
 * tarafındaki fiziksel teslimat akışını (requested→prepared→delivered) izlemeye
 * devam eder ve bu action'dan bağımsız ilerleyebilir. Talep zaten `prepared`
 * veya `delivered` olsa da (teknisyen "Hazırlandı"ya basmış olsa da) çevrilebilir;
 * yalnız daha önce çevrilmiş (convertedAt dolu) talep tekrar çevrilemez.
 */
export async function convertPartsRequestToOrderItemAction(requestId: string) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("parts.purchase")

  const request = await prisma.partsRequest.findFirst({
    where: { id: requestId, workshopId: user.workshopId },
  })
  if (!request) return { error: "Parça talebi bulunamadı" }
  if (request.convertedAt) return { error: "Bu talep zaten kaleme eklendi" }
  if (request.status === "cancelled") return { error: PARTS_REQUEST_CANCELLED_ERROR }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: request.serviceOrderId, workshopId: user.workshopId },
    select: { id: true, status: true, intakeFormId: true },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  const converted = await prisma.$transaction(async (tx) => {
    // `convertedAt`i önce koşullu güncelle: iki eşzamanlı çağrı yarışırsa yalnız
    // biri `count > 0` görür, kalem yalnız o durumda oluşturulur (çift kalem önlenir).
    // `status != cancelled` aynı koşulda: iptalle yarışan çevirme kaybeder ve
    // iptal edilmiş talep için kalem açılmaz.
    const updated = await tx.partsRequest.updateMany({
      where: {
        id: requestId,
        workshopId: user.workshopId,
        convertedAt: null,
        status: { not: "cancelled" },
      },
      data: { convertedAt: new Date() },
    })
    if (updated.count === 0) return false

    // Durum hâlâ "requested" ise "prepared"a çek; teknisyen zaten ilerletmişse
    // (prepared/delivered) geri almadan olduğu gibi bırak.
    await tx.partsRequest.updateMany({
      where: { id: requestId, workshopId: user.workshopId, status: "requested" },
      data: { status: "prepared" },
    })

    await tx.serviceOrderItem.create({
      data: {
        workshopId: user.workshopId,
        serviceOrderId: request.serviceOrderId,
        // Tip bazlı eşleme tek yerde ve saf: src/lib/orders/parts-request-item.ts
        ...partsRequestToItemFields(request),
      },
    })
    return true
  })
  if (!converted) return { error: "Bu talep zaten kaleme eklendi" }

  await AuditLogAction(
    user.workshopId,
    user.id,
    "PartsRequest",
    requestId,
    "parts_request_converted",
    JSON.stringify({ orderId: request.serviceOrderId, partName: request.partName, type: request.type })
  )

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: order.intakeFormId,
    eventType: "parts_request_converted",
    description: `${partsRequestTypeLabel(request.type)} talebi kaleme eklendi: ${request.partName}`,
  })

  revalidatePath(`/orders/${request.serviceOrderId}`)
  revalidatePath(`/technician/orders/${request.serviceOrderId}`)
  return { success: true }
}

/**
 * Bekleyen bir parça talebinin bilgilerini düzeltir (ad, parça no, marka,
 * miktar, not).
 *
 * KALEME EKLENMİŞ TALEP DÜZENLENMEZ: kalem ayrı bir kayıttır ve talep alanları
 * ona kopyalanmıştır — burada değiştirmek iki kaydı sessizce ayrıştırırdı.
 * O durumda düzeltme iş emri kaleminin kendi satırında yapılır.
 * İptal edilmiş talep de düzenlenmez; önce iptali geri alınır.
 */
export async function updatePartsRequestAction(requestId: string, formData: FormData) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("parts.purchase")

  const parsed = partsRequestEditSchema.safeParse({
    partName: (formData.get("partName") as string) || "",
    partSku: (formData.get("partSku") as string) || "",
    brand: (formData.get("brand") as string) || "",
    quantity: (formData.get("quantity") as string) || "1",
    note: (formData.get("note") as string) || "",
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }

  const request = await prisma.partsRequest.findFirst({
    where: { id: requestId, workshopId: user.workshopId },
  })
  if (!request) return { error: "Parça talebi bulunamadı" }
  if (request.convertedAt) return { error: PARTS_REQUEST_CONVERTED_ERROR }
  if (request.status === "cancelled") return { error: PARTS_REQUEST_CANCELLED_ERROR }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: request.serviceOrderId, workshopId: user.workshopId },
    select: { id: true, status: true, intakeFormId: true },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  const data = {
    partName: parsed.data.partName,
    partSku: parsed.data.partSku || null,
    brand: parsed.data.brand || null,
    quantity: parsed.data.quantity,
    note: parsed.data.note || null,
  }

  // Koşullu yazma: düzenleme ile çevirme/iptal yarışırsa düzenleme kaybeder.
  const updated = await prisma.partsRequest.updateMany({
    where: {
      id: requestId,
      workshopId: user.workshopId,
      convertedAt: null,
      status: { not: "cancelled" },
    },
    data,
  })
  if (updated.count === 0) return { error: "Talep bu sırada karara bağlandı, sayfayı yenileyin" }

  await AuditLogAction(
    user.workshopId,
    user.id,
    "PartsRequest",
    requestId,
    "parts_request_edited",
    JSON.stringify({ orderId: request.serviceOrderId, before: {
      partName: request.partName,
      partSku: request.partSku,
      brand: request.brand,
      quantity: request.quantity,
      note: request.note,
    }, after: data }),
    request.serviceOrderId,
  )

  // Ad değiştiyse talebin ne olduğu da değişmiş demektir; zaman çizelgesine
  // yalnız o durumda yazılır (miktar/not düzeltmesi gürültü yaratmasın).
  if (request.partName !== data.partName) {
    await addTimelineEvent({
      workshopId: user.workshopId,
      intakeFormId: order.intakeFormId,
      eventType: "parts_request_edited",
      description: `Parça talebi düzeltildi: ${request.partName} → ${data.partName}`,
    })
  }

  revalidatePath(`/orders/${request.serviceOrderId}`)
  revalidatePath(`/technician/orders/${request.serviceOrderId}`)
  return { success: true }
}

/**
 * Talebi REDDEDER: parça alınmayacak. Karar kapısının (parts-request-guard)
 * ikinci ucu — kaleme eklemenin alternatifi budur, talebi askıda bırakmak değil.
 *
 * Kaleme eklenmiş talep iptal edilemez: kalem zaten oluştu, geri alma yolu o
 * kalemi silmektir (iş emri kalem satırı). Gerekçe atölye içi kalır.
 */
export async function cancelPartsRequestAction(requestId: string, reason: string) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("parts.purchase")

  const parsed = partsRequestCancelSchema.safeParse({ reason: reason ?? "" })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Geçersiz gerekçe" }

  const request = await prisma.partsRequest.findFirst({
    where: { id: requestId, workshopId: user.workshopId },
  })
  if (!request) return { error: "Parça talebi bulunamadı" }
  if (request.convertedAt) return { error: PARTS_REQUEST_CONVERTED_ERROR }
  if (request.status === "cancelled") return { error: "Bu talep zaten iptal edildi" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: request.serviceOrderId, workshopId: user.workshopId },
    select: { id: true, status: true, intakeFormId: true },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  const cancelReason = parsed.data.reason || null

  const cancelled = await prisma.partsRequest.updateMany({
    where: { id: requestId, workshopId: user.workshopId, convertedAt: null, status: { not: "cancelled" } },
    data: { status: "cancelled", cancelledAt: new Date(), cancelReason },
  })
  if (cancelled.count === 0) return { error: "Talep bu sırada karara bağlandı, sayfayı yenileyin" }

  await AuditLogAction(
    user.workshopId,
    user.id,
    "PartsRequest",
    requestId,
    "parts_request_cancelled",
    JSON.stringify({ orderId: request.serviceOrderId, partName: request.partName, reason: cancelReason }),
    request.serviceOrderId,
  )

  // İç olay: gerekçe müşteri yüzeyine çıkmaz (bkz. data-safety denylist'i).
  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: order.intakeFormId,
    eventType: "parts_request_cancelled",
    description: `Parça talebi iptal edildi: ${request.partName}${cancelReason ? ` — ${cancelReason}` : ""}`,
  })

  revalidatePath(`/orders/${request.serviceOrderId}`)
  revalidatePath(`/technician/orders/${request.serviceOrderId}`)
  return { success: true }
}

/** İptali geri alır: talep yeniden karar bekleyen `requested` durumuna döner. */
export async function reopenPartsRequestAction(requestId: string) {
  const { requireWritableWorkshop } = await import("@/lib/technician/feature-auth")
  const { user } = await requireWritableWorkshop("parts.purchase")

  const request = await prisma.partsRequest.findFirst({
    where: { id: requestId, workshopId: user.workshopId },
  })
  if (!request) return { error: "Parça talebi bulunamadı" }
  if (request.status !== "cancelled") return { error: "Bu talep iptal edilmemiş" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: request.serviceOrderId, workshopId: user.workshopId },
    select: { id: true, status: true, intakeFormId: true },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: ORDER_LOCKED_ERROR }

  await prisma.partsRequest.updateMany({
    where: { id: requestId, workshopId: user.workshopId, status: "cancelled" },
    data: { status: "requested", cancelledAt: null, cancelReason: null },
  })

  await AuditLogAction(
    user.workshopId,
    user.id,
    "PartsRequest",
    requestId,
    "parts_request_reopened",
    JSON.stringify({ orderId: request.serviceOrderId, partName: request.partName }),
    request.serviceOrderId,
  )

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: order.intakeFormId,
    eventType: "parts_request_reopened",
    description: `Parça talebinin iptali geri alındı: ${request.partName}`,
  })

  revalidatePath(`/orders/${request.serviceOrderId}`)
  revalidatePath(`/technician/orders/${request.serviceOrderId}`)
  return { success: true }
}

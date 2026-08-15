"use server"

import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { addTimelineEvent } from "@/lib/intake/timeline"
import { serviceOrderItemSchema, serviceOrderItemUpdateSchema, purchaseItemCreateSchema, purchaseItemUpdateSchema, orderInvoiceSchema } from "@/lib/validations/order"
import { isArrivalReason, type ArrivalReasonKey } from "@/lib/constants"
import { revalidatePath } from "next/cache"
import { createServiceOrderForIntake } from "@/lib/orders/create-service-order"
import { findUnpricedItems, unpricedItemsMessage } from "@/lib/orders/pricing-guard"
import { recalcOrderPayment } from "@/lib/cashbox/recalc"
import { reserveStockInTx, returnStockInTx, getActiveWorkshopPart } from "@/lib/parts/stock-movement"
import { getVisibleBakimxProduct } from "@/lib/parts/bakimx-catalog"
import { bakimxLineItemFields, type BakimxLineItemFields } from "@/lib/parts/bakimx-item"
import { validateBakimxProductFitment } from "@/lib/parts/bakimx-fitment"
import { resolveFeature } from "@/lib/features"
import type { PlanTier } from "@/lib/plan"
import { getStorageProvider, validateUploadFile, buildStoragePath } from "@/lib/storage"
import { trDateToDate } from "@/lib/format"
import { nanoid } from "nanoid"
import { computeStockDelta } from "@/lib/parts/stock-delta"
import { isOrderStatus, canTransitionOrder, isIntakeStatus, canTransitionIntake, isOrderLocked } from "@/lib/status-transitions"
import type { OrderStatus, IntakeStatus } from "@prisma/client"
import { notifyWorkOrderCompleted, notifyPaymentReminder } from "@/lib/communications/triggers"
import { syncDeliveryToCalendar } from "@/lib/calendar/sync"
import { z } from "zod/v4"
import { VISIBLE_PHOTO } from "@/lib/intake/photo-visibility"

export async function createServiceOrderAction(intakeFormId: string) {
  const { requireWritableWorkshop } = await import("@/lib/auth")
  const { user } = await requireWritableWorkshop("order.edit")

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
  // Kalemin kaynağı: katalog akışı mı, manuel mi, BakımX kataloğu mu. Rozet +
  // raporlama içindir; `bakimx` gönderilse bile ürün doğrulanamazsa yazılmaz.
  source: z.enum(["catalog", "manual", "bakimx"]).optional(),
})

export async function addOrderItemAction(formData: FormData) {
  const { requireWritableWorkshop } = await import("@/lib/auth")
  const { user, workshop } = await requireWritableWorkshop("order.edit")

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
    tecdocArticleId: formData.get("tecdocArticleId") as string,
    partId: formData.get("partId") as string,
    brand: formData.get("brand") as string,
    category: formData.get("category") as string,
    categoryId: formData.get("categoryId") as string,
    source: formData.get("source") as string,
    bakimxProductId: formData.get("bakimxProductId") as string,
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
    tecdocArticleId: raw.tecdocArticleId ? Number(raw.tecdocArticleId) : undefined,
    partId: raw.partId || undefined,
    brand: raw.brand || undefined,
    category: raw.category || undefined,
    categoryId: raw.categoryId ? Number(raw.categoryId) : undefined,
    source: raw.source || undefined,
    bakimxProductId: raw.bakimxProductId || undefined,
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
  // partId set edildiyse parça kendi stoğumuzdan seçilmiştir: workshopId scope
  // doğrula, stok düş ve StockMovement (type=out) oluştur.
  const partId = parsed.data.partId || null
  if (partId) {
    const part = await getActiveWorkshopPart(user.workshopId, partId)
    if (!part) return { error: "Parça bulunamadı veya pasif" }
  }

  // BakımX katalog kalemi (BAK-35). Ürün sunucuda okunur ve kalemin kimlik +
  // fiyat alanları ORADAN türetilir: istemcinin gönderdiği ad/fiyat yazılmaz,
  // pasifleşmiş ya da yayından kalkmış ürün eklenemez, kapı kapalı atölye bu
  // yoldan katalog kalemi yazamaz. Alan kuralları (partId/categoryId boş, fiyat
  // `purchasePriceKurus`'a) tek yerde: lib/parts/bakimx-item.ts.
  let bakimxFields: BakimxLineItemFields | null = null
  if (parsed.data.bakimxProductId) {
    // Katalog ürünü yalnız PARÇA kalemi olabilir; işçiliğe ürün bağı takılırsa
    // rozet ve raporlama anlamsızlaşır.
    if (parsed.data.type !== "part") return { error: "BakımX ürünü yalnız parça kalemine eklenebilir" }
    const gateOpen = await resolveFeature(
      workshop.id,
      workshop.planTier as PlanTier,
      "bakimxCatalog",
    )
    if (!gateOpen) return { error: "BakımX ürün kataloğu bu çalışma alanında kapalı." }
    // Araç süzgeci burada BİLEREK boş: araç uyumluluğu aşağıda siparişin kendi
    // aracıyla ayrıca doğrulanır (BAK-46). `workshop.id` iskonto için gerekir
    // (BAK-47) — fiyat atölye kaydından okunur, istemciden değil.
    const product = await getVisibleBakimxProduct(parsed.data.bakimxProductId, null, workshop.id)
    if (!product) return { error: "BakımX ürünü bulunamadı veya yayından kaldırılmış" }
    bakimxFields = bakimxLineItemFields(product)
  }

  // Araç uyumluluğu kontrolü (BAK-46): vehicle_linked ürünler sadece uyumlu araçlara
  // eklenebilir. Sunucu otoritesi: araç tipi kalem yazımından değil, siparişten okunur.
  if (bakimxFields) {
    const intake = await prisma.vehicleIntakeForm.findUnique({
      where: { id: order.intakeFormId },
      select: { vehicle: { select: { catalogVehicleTypeId: true } } },
    })
    const vehicleTypeId = intake?.vehicle.catalogVehicleTypeId ?? null
    const fitmentValid = await validateBakimxProductFitment(parsed.data.bakimxProductId!, vehicleTypeId)
    if (!fitmentValid) return { error: "BakımX ürünü seçili araç ile uyumlu değildir" }
  }

  let createdItemId: string | null = null
  try {
    createdItemId = await prisma.$transaction(async (tx) => {
      const created = await tx.serviceOrderItem.create({
        data: {
          workshopId: user.workshopId,
          serviceOrderId: raw.serviceOrderId,
          type: parsed.data.type,
          // BakımX kaleminde kimlik/fiyat alanları ürün kaydından gelir; kalan
          // her şey (miktar, not, satış fiyatı) kullanıcınındır.
          name: bakimxFields?.name ?? parsed.data.name,
          sku: bakimxFields?.sku ?? parsed.data.sku ?? null,
          unit: bakimxFields?.unit ?? parsed.data.unit ?? null,
          quantity: parsed.data.quantity,
          unitPrice: parsed.data.unitPrice ?? bakimxFields?.unitPrice ?? null,
          totalPrice: parsed.data.totalPrice ?? null,
          note: parsed.data.note || null,
          tecdocArticleId: bakimxFields ? null : parsed.data.tecdocArticleId ?? null,
          // BakımX stoğu atölyenin stoğu DEĞİL → bağ kurulmaz, stok düşmez.
          partId: bakimxFields ? null : partId,
          brand: bakimxFields ? bakimxFields.brand : parsed.data.brand || null,
          category: bakimxFields ? bakimxFields.category : parsed.data.category || null,
          // BakımX'te null: o kolon TecDoc düğüm id'si, iç taksonomi anahtarı oraya yazılmaz.
          categoryId: bakimxFields ? null : parsed.data.categoryId ?? null,
          bakimxProductId: bakimxFields?.bakimxProductId ?? null,
          // Alış fiyatı anlık görüntüdür: ürün sonradan zamlansa da bu satır donar.
          purchasePriceKurus: bakimxFields?.purchasePriceKurus ?? null,
          source: bakimxFields ? bakimxFields.source : parsed.data.source ?? null,
        },
      })
      // Stok düş (sadece part'ı olan parça kalemleri için).
      if (!bakimxFields && partId && parsed.data.type === "part") {
        await reserveStockInTx(
          tx,
          user.workshopId,
          partId,
          parsed.data.quantity,
          "work_order",
          created.id,
          user.id,
          `İş emri ${order.workOrderNo || ""}: ${parsed.data.name}`,
        )
      }
      await recalcOrderPayment(tx, raw.serviceOrderId, user.workshopId)
      return created.id
    })
  } catch (err) {
    // Yetersiz stok / pasif parça hatalarını kullanıcıya döndür.
    return { error: err instanceof Error ? err.message : "Kalem eklenemedi" }
  }

  await AuditLogAction(
    user.workshopId,
    user.id,
    "ServiceOrderItem",
    createdItemId,
    "order_item_added",
    JSON.stringify({
      name: parsed.data.name,
      type: parsed.data.type,
      quantity: parsed.data.quantity,
      unitPrice: parsed.data.unitPrice,
    }),
    raw.serviceOrderId,
  )

  revalidatePath(`/orders/${raw.serviceOrderId}`)
  return { success: true, id: createdItemId }
}

/**
 * Teknisyenin dışarıdan (firmadan) satın aldığı parçayı doğrudan iş emrine kalem
 * olarak ekler (source=purchase). Alış fiyatı/tedarikçi/tarih/alan teknisyen +
 * parça kutusu fotoğrafı kaydedilir; satış unitPrice'ı alış fiyatından otomatik
 * doldurulur (masa sonradan bağımsız düzenler). Stok hareketi YOKtur (partId yok).
 *
 * Not: fotoğraf 8MB'a kadar olabildiğinden bu action server-action body limitine
 * takılmamak için /api/orders/purchases route'undan çağrılır (fetch + FormData).
 */
export async function addPurchaseItemAction(formData: FormData) {
  const { requireWritableWorkshop } = await import("@/lib/auth")
  const { user } = await requireWritableWorkshop("parts.purchase")

  const serviceOrderId = formData.get("serviceOrderId") as string
  const rawPurchasedAt = (formData.get("purchasedAt") as string) || ""
  const file = formData.get("file") as File | null

  const parsed = purchaseItemCreateSchema.safeParse({
    name: ((formData.get("name") as string) || "").trim(),
    sku: (formData.get("sku") as string) || undefined,
    quantity: formData.get("quantity") ? Number(formData.get("quantity")) : 1,
    purchasePriceKurus: formData.get("purchasePriceKurus")
      ? Number(formData.get("purchasePriceKurus"))
      : undefined,
    supplierName: (formData.get("supplierName") as string) || undefined,
    supplierId: (formData.get("supplierId") as string) || undefined,
    purchasedById: (formData.get("purchasedById") as string) || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: serviceOrderId, workshopId: user.workshopId },
    select: { id: true, intakeFormId: true, status: true, workOrderNo: true },
  })
  if (!order) return { error: "Servis emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: "Teslim edilmiş veya iptal edilmiş iş emrine kalem eklenemez" }

  // İsteğe bağlı FK'ler kullanılmadan önce workshop-scope doğrulanır.
  const supplierId = parsed.data.supplierId || null
  if (supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, workshopId: user.workshopId },
      select: { id: true },
    })
    if (!supplier) return { error: "Tedarikçi bulunamadı" }
  }
  const purchasedById = parsed.data.purchasedById || null
  if (purchasedById) {
    const tech = await prisma.technician.findFirst({
      where: { id: purchasedById, workshopId: user.workshopId },
      select: { id: true },
    })
    if (!tech) return { error: "Teknisyen bulunamadı" }
  }

  const purchasedAt = trDateToDate(rawPurchasedAt) ?? new Date()
  const purchasePriceKurus = parsed.data.purchasePriceKurus

  // Fotoğraf yüklemesi transaction öncesinde (addPhotoAction deseni). Alış fotosu
  // dahili-yalnızdır; galeriler serviceOrderItemId != null ile filtreler.
  const photoId = nanoid()
  let photoUpload: { url: string; key: string; fileName: string; mimeType: string; sizeBytes: number; storageProvider: string } | null = null
  if (file && file.size > 0 && file.name) {
    const validation = validateUploadFile(file)
    if (!validation.valid) return { error: validation.error }
    try {
      const storagePath = buildStoragePath(user.workshopId, order.intakeFormId, "purchase", photoId, file.name)
      const provider = await getStorageProvider()
      const result = await provider.upload(file, storagePath)
      photoUpload = {
        url: result.url,
        key: result.key,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        storageProvider: process.env.STORAGE_PROVIDER || "mock",
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Dosya yükleme hatası"
      return { error: `Fotoğraf yüklenemedi: ${message}` }
    }
  }

  let createdItemId: string | null = null
  try {
    createdItemId = await prisma.$transaction(async (tx) => {
      const created = await tx.serviceOrderItem.create({
        data: {
          workshopId: user.workshopId,
          serviceOrderId: order.id,
          type: "part",
          source: "purchase",
          name: parsed.data.name,
          sku: parsed.data.sku || null,
          quantity: parsed.data.quantity,
          // Satış fiyatı alıştan otomatik dolar; totalPrice null → recalc/totals.ts
          // unitPrice×quantity kullanır.
          unitPrice: purchasePriceKurus,
          totalPrice: null,
          purchasePriceKurus,
          supplierName: parsed.data.supplierName || null,
          supplierId,
          purchasedAt,
          purchasedById,
        },
      })
      if (photoUpload) {
        await tx.vehiclePhoto.create({
          data: {
            id: photoId,
            workshopId: user.workshopId,
            intakeFormId: order.intakeFormId,
            serviceOrderId: order.id,
            serviceOrderItemId: created.id,
            type: "other",
            phase: "repair_progress",
            label: "Satın alma — parça kutusu",
            fileUrl: photoUpload.url,
            fileName: photoUpload.fileName,
            mimeType: photoUpload.mimeType,
            sizeBytes: photoUpload.sizeBytes,
            storageProvider: photoUpload.storageProvider,
            storageKey: photoUpload.key,
          },
        })
      }
      await recalcOrderPayment(tx, order.id, user.workshopId)
      return created.id
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Kalem eklenemedi" }
  }

  await AuditLogAction(
    user.workshopId,
    user.id,
    "ServiceOrderItem",
    createdItemId,
    "purchase_recorded",
    JSON.stringify({
      name: parsed.data.name,
      quantity: parsed.data.quantity,
      purchasePriceKurus,
      supplierName: parsed.data.supplierName || null,
      hasPhoto: !!photoUpload,
    }),
    order.id,
  )

  revalidatePath(`/orders/${order.id}`)
  revalidatePath(`/technician/orders/${order.id}`)
  revalidatePath("/purchases")
  return { success: true, id: createdItemId }
}

/**
 * Dış alım kaleminin (source=purchase) alış metadata'sını günceller: tedarikçi,
 * alış tarihi, alış fiyatı ve isteğe bağlı yeni parça kutusu fotoğrafı. Satış
 * unitPrice'ına DOKUNMAZ (oluşturma sonrası bağımsızdır). Alış fiyatı iş emri
 * toplamını etkilemez → recalc gerekmez. Kilitli emir reddedilir.
 */
export async function updatePurchaseItemAction(itemId: string, orderId: string, formData: FormData) {
  const { requireWritableWorkshop } = await import("@/lib/auth")
  const { user } = await requireWritableWorkshop("parts.purchase")

  const item = await prisma.serviceOrderItem.findFirst({
    where: { id: itemId, workshopId: user.workshopId },
    select: { id: true, source: true, serviceOrderId: true },
  })
  if (!item) return { error: "Kalem bulunamadı" }
  if (item.source !== "purchase") return { error: "Bu kalem bir dış alım değil" }
  if (item.serviceOrderId !== orderId) return { error: "Kalem bu iş emrine ait değil" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
    select: { id: true, intakeFormId: true, status: true },
  })
  if (!order) return { error: "Servis emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: "Teslim edilmiş veya iptal edilmiş iş emri düzenlenemez" }

  const has = (k: string) => formData.get(k) !== null
  const parsed = purchaseItemUpdateSchema.safeParse({
    purchasePriceKurus: has("purchasePriceKurus") ? Number(formData.get("purchasePriceKurus")) : undefined,
    supplierName: has("supplierName") ? (formData.get("supplierName") as string) : undefined,
    supplierId: has("supplierId") ? ((formData.get("supplierId") as string) || null) : undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  const data: {
    purchasePriceKurus?: number
    supplierName?: string | null
    supplierId?: string | null
    purchasedAt?: Date
  } = {}
  if (parsed.data.purchasePriceKurus !== undefined) data.purchasePriceKurus = parsed.data.purchasePriceKurus
  if (parsed.data.supplierName !== undefined) data.supplierName = parsed.data.supplierName || null
  if (parsed.data.supplierId !== undefined) {
    const sid = parsed.data.supplierId || null
    if (sid) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: sid, workshopId: user.workshopId },
        select: { id: true },
      })
      if (!supplier) return { error: "Tedarikçi bulunamadı" }
    }
    data.supplierId = sid
  }
  if (has("purchasedAt")) {
    const d = trDateToDate(formData.get("purchasedAt") as string)
    if (d) data.purchasedAt = d
  }

  // İsteğe bağlı yeni fotoğraf: eskisini geçmiş olarak bırakır, yenisini bağlar.
  const file = formData.get("file") as File | null
  let photoUpload: { url: string; key: string; fileName: string; mimeType: string; sizeBytes: number; storageProvider: string; id: string } | null = null
  if (file && file.size > 0 && file.name) {
    const validation = validateUploadFile(file)
    if (!validation.valid) return { error: validation.error }
    try {
      const newPhotoId = nanoid()
      const storagePath = buildStoragePath(user.workshopId, order.intakeFormId, "purchase", newPhotoId, file.name)
      const provider = await getStorageProvider()
      const result = await provider.upload(file, storagePath)
      photoUpload = {
        id: newPhotoId,
        url: result.url,
        key: result.key,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        storageProvider: process.env.STORAGE_PROVIDER || "mock",
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Dosya yükleme hatası"
      return { error: `Fotoğraf yüklenemedi: ${message}` }
    }
  }

  if (Object.keys(data).length === 0 && !photoUpload) {
    return { error: "Güncellenecek bir alan yok" }
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        const updRes = await tx.serviceOrderItem.updateMany({
          where: { id: itemId, workshopId: user.workshopId },
          data,
        })
        if (updRes.count !== 1) throw new Error("Kalem bulunamadı")
      }
      if (photoUpload) {
        await tx.vehiclePhoto.create({
          data: {
            id: photoUpload.id,
            workshopId: user.workshopId,
            intakeFormId: order.intakeFormId,
            serviceOrderId: order.id,
            serviceOrderItemId: itemId,
            type: "other",
            phase: "repair_progress",
            label: "Satın alma — parça kutusu",
            fileUrl: photoUpload.url,
            fileName: photoUpload.fileName,
            mimeType: photoUpload.mimeType,
            sizeBytes: photoUpload.sizeBytes,
            storageProvider: photoUpload.storageProvider,
            storageKey: photoUpload.key,
          },
        })
      }
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Kalem güncellenemedi" }
  }

  await AuditLogAction(
    user.workshopId,
    user.id,
    "ServiceOrderItem",
    itemId,
    "purchase_updated",
    JSON.stringify({ changes: data, photoReplaced: !!photoUpload }),
    orderId,
  )

  revalidatePath(`/orders/${orderId}`)
  revalidatePath(`/technician/orders/${orderId}`)
  revalidatePath("/purchases")
  return { success: true }
}

export async function removeOrderItemAction(itemId: string, orderId: string) {
  const { requireWritableWorkshop } = await import("@/lib/auth")
  const { user } = await requireWritableWorkshop("order.edit")

  const item = await prisma.serviceOrderItem.findFirst({
    where: { id: itemId, workshopId: user.workshopId },
  })
  if (!item) return { error: "Kalem bulunamadı" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "Servis emri bulunamadı" }
  if (isOrderLocked(order.status)) return { error: "Teslim edilmiş veya iptal edilmiş iş emrinden kalem silinemez" }

  // Dış alım kaleminin bağlı parça-kutusu fotoğraflarını topla (FK ON DELETE SET
  // NULL olduğu için satır silinince foto yetim kalır → açıkça temizlenir).
  const purchasePhotos =
    item.source === "purchase"
      ? await prisma.vehiclePhoto.findMany({
          where: { serviceOrderItemId: itemId, workshopId: user.workshopId },
          select: { id: true, storageKey: true },
        })
      : []

  const deleteResult = await prisma.$transaction(async (tx) => {
    // Bağlı alış fotoğraflarının DB kayıtları (FK'yi null'a çekmeden önce sil).
    if (purchasePhotos.length > 0) {
      await tx.vehiclePhoto.deleteMany({
        where: { serviceOrderItemId: itemId, workshopId: user.workshopId },
      })
    }
    // Önce silme (aşağıdaki iade zaten parçayı getirecek).
    const result = await tx.serviceOrderItem.deleteMany({
      where: { id: itemId, workshopId: user.workshopId },
    })
    if (result.count > 0) {
      // partId set olan parça kalemi ise stok iade et.
      if (item.partId && item.type === "part" && item.quantity > 0) {
        await returnStockInTx(
          tx,
          user.workshopId,
          item.partId,
          item.quantity,
          "work_order",
          itemId,
          user.id,
          `İş emrinden silindi: ${item.name}`,
        )
      }
      await recalcOrderPayment(tx, orderId, user.workshopId)
    }
    return result
  })
  if (deleteResult.count === 0) return { error: "Kalem bulunamadı" }

  // Storage nesnelerini best-effort sil — hata DB silmeyi geri almaz, yalnız loglanır.
  if (purchasePhotos.length > 0) {
    try {
      const provider = await getStorageProvider()
      await Promise.all(
        purchasePhotos
          .filter((p) => p.storageKey)
          .map((p) => provider.delete(p.storageKey as string)),
      )
    } catch (err) {
      await AuditLogAction(
        user.workshopId,
        user.id,
        "VehiclePhoto",
        itemId,
        "photo_storage_delete_error",
        JSON.stringify({ error: err instanceof Error ? err.message : "bilinmeyen", count: purchasePhotos.length }),
        orderId,
      )
    }
  }

  await AuditLogAction(
    user.workshopId,
    user.id,
    "ServiceOrderItem",
    itemId,
    "order_item_removed",
    JSON.stringify({ name: item.name, type: item.type, quantity: item.quantity, source: item.source }),
    orderId,
  )

  revalidatePath(`/orders/${orderId}`)
  if (item.source === "purchase") {
    revalidatePath(`/technician/orders/${orderId}`)
    revalidatePath("/purchases")
  }
  return { success: true }
}

export async function updateOrderItemAction(itemId: string, orderId: string, formData: FormData) {
  const { requireWritableWorkshop } = await import("@/lib/auth")
  const { user } = await requireWritableWorkshop("order.edit")

  const item = await prisma.serviceOrderItem.findFirst({
    where: { id: itemId, workshopId: user.workshopId },
  })
  if (!item) return { error: "Kalem bulunamadı" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "Servis emri bulunamadı" }
  if (item.serviceOrderId !== orderId) return { error: "Kalem bu iş emrine ait değil" }
  if (isOrderLocked(order.status)) return { error: "Teslim edilmiş veya iptal edilmiş iş emri düzenlenemez" }

  // Yalnızca formData'da gerçekten bulunan alanlar patch'lenir (kısmi güncelleme).
  const has = (k: string) => formData.get(k) !== null
  const raw = {
    name: has("name") ? (formData.get("name") as string).trim() : undefined,
    sku: has("sku") ? (formData.get("sku") as string) : undefined,
    unit: has("unit") ? (formData.get("unit") as string) : undefined,
    quantity: has("quantity") ? Number(formData.get("quantity")) : undefined,
    unitPrice: has("unitPrice") ? Number(formData.get("unitPrice")) : undefined,
    note: has("note") ? (formData.get("note") as string) : undefined,
    brand: has("brand") ? (formData.get("brand") as string) : undefined,
    category: has("category") ? (formData.get("category") as string) : undefined,
    categoryId: has("categoryId")
      ? ((formData.get("categoryId") as string) === "" ? null : Number(formData.get("categoryId")))
      : undefined,
    tecdocArticleId: has("tecdocArticleId")
      ? ((formData.get("tecdocArticleId") as string) === "" ? null : Number(formData.get("tecdocArticleId")))
      : undefined,
  }

  const parsed = serviceOrderItemUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  // Katalogdan (TecDoc) eklenen parçanın kimliği — ad, parça no, marka, kategori —
  // katalog verisidir ve değiştirilemez; aksi halde satır ⓘ detayda/fiyat
  // karşılaştırmada başka bir parçayı gösterirdi. UI bu alanları salt-okunur
  // render eder; burada sunucu tarafında da zorlanır. İstisna: satır komple BAŞKA
  // bir katalog parçasıyla değiştiriliyorsa (yeni tecdocArticleId) kimlik birlikte
  // değişir.
  if (item.type === "part" && item.tecdocArticleId != null) {
    const replacingArticle =
      parsed.data.tecdocArticleId != null && parsed.data.tecdocArticleId !== item.tecdocArticleId
    // Katalogdan DOLU gelen alan değiştirilemez/silinemez; katalogda boş kalan
    // alan (bazı kayıtlarda kategori/marka gelmiyor) doldurulabilir — orada
    // bozulacak katalog verisi yok. UI da aynı kuralı uyguluyor (AttrCell).
    const overwrites = (next: string | undefined, current: string | null) =>
      next !== undefined && current != null && (next || null) !== current
    const changesIdentity =
      (parsed.data.name !== undefined && parsed.data.name !== item.name) ||
      overwrites(parsed.data.sku, item.sku) ||
      overwrites(parsed.data.brand, item.brand) ||
      overwrites(parsed.data.category, item.category) ||
      (parsed.data.categoryId !== undefined &&
        item.categoryId != null &&
        (parsed.data.categoryId ?? null) !== item.categoryId)
    if (!replacingArticle && changesIdentity) {
      return { error: "Katalogdan eklenen parçanın adı, kodu, markası ve kategorisi değiştirilemez" }
    }
  }

  // Boş string gönderilen serbest-metin alanları null'a çevrilir (temizleme).
  const data: {
    name?: string
    sku?: string | null
    unit?: string | null
    quantity?: number
    unitPrice?: number | null
    note?: string | null
    brand?: string | null
    category?: string | null
    categoryId?: number | null
    tecdocArticleId?: number | null
    totalPrice?: number | null
  } = {}
  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.sku !== undefined) data.sku = parsed.data.sku || null
  if (parsed.data.unit !== undefined) data.unit = parsed.data.unit || null
  if (parsed.data.quantity !== undefined) data.quantity = parsed.data.quantity
  if (parsed.data.unitPrice !== undefined) data.unitPrice = parsed.data.unitPrice
  if (parsed.data.note !== undefined) data.note = parsed.data.note || null
  if (parsed.data.brand !== undefined) data.brand = parsed.data.brand || null
  if (parsed.data.category !== undefined) data.category = parsed.data.category || null
  if (parsed.data.categoryId !== undefined) data.categoryId = parsed.data.categoryId ?? null
  if (parsed.data.tecdocArticleId !== undefined) data.tecdocArticleId = parsed.data.tecdocArticleId ?? null

  // Miktar veya birim fiyat değiştiyse, tekliften kopyalanmış olabilecek bayat
  // totalPrice satır totalini/genel toplamı yanlış gösterir — null'a çekip
  // unitPrice×quantity fallback'ine düşür (totals.ts ve recalc bunu kullanır).
  if (data.quantity !== undefined || data.unitPrice !== undefined) {
    data.totalPrice = null
  }

  // Miktar değiştiyse ve satır kendi stoğumuza bağlıysa (partId + type=part) stok farkını mutabık kıl.
  const newQty = parsed.data.quantity
  const stockNeedsSync =
    newQty !== undefined && newQty !== item.quantity && item.partId != null && item.type === "part"

  try {
    await prisma.$transaction(async (tx) => {
      // Miktar değişiyorsa optimistik kilit (CAS): satır hâlâ okuduğumuz miktarda mı?
      // Değilse (eşzamanlı düzenleme veya çift gönderim) stok deltası bayat kalır ve
      // envanteri sessizce bozardı — reddet.
      const guardedWhere =
        newQty !== undefined
          ? { id: itemId, workshopId: user.workshopId, quantity: item.quantity }
          : { id: itemId, workshopId: user.workshopId }
      const updRes = await tx.serviceOrderItem.updateMany({ where: guardedWhere, data })
      if (updRes.count !== 1) {
        throw new Error("Kalem bu sırada değişti, lütfen sayfayı yenileyip tekrar deneyin")
      }

      if (stockNeedsSync && item.partId) {
        const delta = computeStockDelta(item.quantity, newQty!)
        if (delta.direction === "reserve") {
          await reserveStockInTx(
            tx, user.workshopId, item.partId, delta.amount, "work_order", itemId, user.id,
            `İş emri ${order.workOrderNo || ""}: miktar güncellendi (${item.name})`,
          )
        } else if (delta.direction === "return") {
          await returnStockInTx(
            tx, user.workshopId, item.partId, delta.amount, "work_order", itemId, user.id,
            `İş emri ${order.workOrderNo || ""}: miktar düşürüldü (${item.name})`,
          )
        }
      }

      await recalcOrderPayment(tx, orderId, user.workshopId)
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Kalem güncellenemedi" }
  }

  await AuditLogAction(
    user.workshopId,
    user.id,
    "ServiceOrderItem",
    itemId,
    "order_item_updated",
    JSON.stringify({ name: item.name, changes: data }),
    orderId,
  )

  revalidatePath(`/orders/${orderId}`)
  return { success: true }
}

export async function updateOrderStatusAction(orderId: string, status: string) {
  const { requireWritableWorkshop } = await import("@/lib/auth")
  const { user } = await requireWritableWorkshop("order.status")

  if (!isOrderStatus(status)) return { error: "Geçersiz durum" }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
  })
  if (!order) return { error: "Servis emri bulunamadı" }

  if (!canTransitionOrder(order.status as OrderStatus, status)) {
    return { error: "Bu durum geçişine izin verilmiyor" }
  }

  // Teslimden sonra kalemler kilitlenir, fiyat bir daha girilemez: fiyatsız kalemle
  // teslime izin verme. OTP akışı bunu zaten önce kontrol eder; burası OTP dışı
  // her yolu (doğrudan action/API çağrısı) kapatan son savunma.
  if (status === "delivered") {
    const items = await prisma.serviceOrderItem.findMany({
      where: { serviceOrderId: orderId, workshopId: user.workshopId },
      select: { id: true, name: true, unitPrice: true },
      orderBy: { createdAt: "asc" },
    })
    const unpriced = findUnpricedItems(items)
    if (unpriced.length > 0) return { error: unpricedItemsMessage(unpriced) }
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

const orderMetaSchema = z.object({
  technicianName: z.string().max(120).optional().or(z.literal("")),
  estimatedDeliveryAt: z.string().optional().or(z.literal("")),
  discountAmount: z.coerce.number().int("İndirim tutarı kuruş (tam sayı) olmalıdır").min(0).optional(), // kuruş
  taxRate: z.coerce.number().int("KDV oranı bps (tam sayı) olmalıdır").min(0).max(10000).optional(), // bps (2000 = %20)
  notes: z.string().max(2000).optional().or(z.literal("")),
})

export async function updateOrderMetaAction(orderId: string, formData: FormData) {
  const { requireWritableWorkshop } = await import("@/lib/auth")
  const { user } = await requireWritableWorkshop("order.edit")

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

/**
 * Fatura no + tarih elle girilir. `isOrderLocked` BİLEREK uygulanmaz: fatura
 * pratikte araç teslim edildikten sonra kesilir, bu yüzden teslim edilmiş iş
 * emrinde de bu iki alan yazılabilir kalır. Kalem/fiyat/fotoğraf/durum kilidi
 * aynen sürer. İptal edilmiş emir istisnadır — iş hiç yapılmadı.
 */
export async function updateOrderInvoiceAction(orderId: string, formData: FormData) {
  const { requireWritableWorkshop } = await import("@/lib/auth")
  const { user } = await requireWritableWorkshop("order.edit")

  const parsed = orderInvoiceSchema.safeParse({
    invoiceNo: (formData.get("invoiceNo") as string) ?? "",
    invoiceDate: (formData.get("invoiceDate") as string) ?? "",
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz fatura bilgisi" }
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
    select: { id: true, status: true, invoiceNo: true, invoiceDate: true },
  })
  if (!order) return { error: "Servis emri bulunamadı" }
  if (order.status === "cancelled") {
    return { error: "İptal edilmiş iş emrine fatura bilgisi girilemez" }
  }

  // `trDateToDate` takvim geçerliliğini KONTROL ETMEZ: "31.02.2026" Invalid Date
  // üretmez, sessizce 03.03.2026'ya taşar. Şema yalnız GG.AA.YYYY biçimine baktığı
  // için bu sessiz bozulmayı burada kapatıyoruz — çevrilen tarihin parçaları girdiyle
  // birebir aynı değilse tarih geçersizdir. (DatePicker böyle bir değer üretemez;
  // koruma doğrudan API'ye POST eden çağrılar içindir.)
  let invoiceDate: Date | null = null
  if (parsed.data.invoiceDate) {
    const [day, month, year] = parsed.data.invoiceDate.split(".").map(Number)
    const converted = trDateToDate(parsed.data.invoiceDate)
    if (
      !converted ||
      converted.getDate() !== day ||
      converted.getMonth() + 1 !== month ||
      converted.getFullYear() !== year
    ) {
      return { error: "Geçerli bir tarih seçiniz" }
    }
    invoiceDate = converted
  }

  const invoiceNo = parsed.data.invoiceNo || null

  await prisma.serviceOrder.updateMany({
    where: { id: orderId, workshopId: user.workshopId },
    data: { invoiceNo, invoiceDate },
  })

  await AuditLogAction(
    user.workshopId,
    user.id,
    "ServiceOrder",
    orderId,
    "order_invoice_updated",
    JSON.stringify({
      from: { invoiceNo: order.invoiceNo, invoiceDate: order.invoiceDate?.toISOString() ?? null },
      to: { invoiceNo, invoiceDate: invoiceDate?.toISOString() ?? null },
    }),
    orderId,
  )

  revalidatePath(`/orders/${orderId}`)
  return { success: true }
}

/**
 * Servise geliş nedeni, işin İÇERİĞİNE dair bir bilgidir: fatura alanlarının
 * aksine teslim/iptal sonrası kilitlenir. Boş string nedeni temizler.
 */
export async function updateOrderArrivalReasonAction(orderId: string, reason: string) {
  const { requireWritableWorkshop } = await import("@/lib/auth")
  const { user } = await requireWritableWorkshop("order.edit")

  // Ayrı `if` bloğu bilinçli: tek satırlık koşulda TS `reason`'ı daraltamıyor.
  let nextReason: ArrivalReasonKey | null = null
  if (reason !== "") {
    if (!isArrivalReason(reason)) return { error: "Geçersiz geliş nedeni" }
    nextReason = reason
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
    select: { id: true, status: true, arrivalReason: true },
  })
  if (!order) return { error: "Servis emri bulunamadı" }
  if (isOrderLocked(order.status)) {
    return { error: "Teslim edilmiş veya iptal edilmiş iş emri düzenlenemez" }
  }

  await prisma.serviceOrder.updateMany({
    where: { id: orderId, workshopId: user.workshopId },
    data: { arrivalReason: nextReason },
  })

  await AuditLogAction(
    user.workshopId,
    user.id,
    "ServiceOrder",
    orderId,
    "order_arrival_reason_set",
    JSON.stringify({ from: order.arrivalReason, to: nextReason }),
    orderId,
  )

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
      intakeForm: { include: { customer: true, vehicle: true, damageMarks: true, photos: { where: VISIBLE_PHOTO } } },
      items: true,
    },
  })
  return order
}

/**
 * Teslim edilmiş iş emrini yeniden açar (#183 — yalnız Yönetici).
 *
 * Genel durum action'ı üzerinden YAPILMAZ: `ORDER_TRANSITIONS.delivered` bilerek
 * boş bırakıldı, teslim tek yönlü bir kapı. Geri alma ayrı bir yetenek
 * (`order.reopen`) ve ayrı bir action olarak durur ki genel durum yolunu
 * gevşetmek zorunda kalmayalım.
 *
 * Teslimden hemen önceki duruma dönülür (`ready_for_delivery`): araç geri
 * geldiğinde iş oradan devam eder. Tahsilat, paylaşım linki ve onay kayıtlarına
 * DOKUNULMAZ — para ve müşteri onayı geçmişi geriye alınmaz.
 */
export async function reopenDeliveredOrderAction(orderId: string, reason: string) {
  const { requireWritableWorkshop } = await import("@/lib/auth")
  const { user } = await requireWritableWorkshop("order.reopen")

  const justification = reason.trim()
  if (justification.length < 5) {
    return { error: "Yeniden açma gerekçesi en az 5 karakter olmalıdır" }
  }

  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId: user.workshopId },
    select: { id: true, status: true, intakeFormId: true },
  })
  if (!order) return { error: "İş emri bulunamadı" }
  if (order.status !== "delivered") {
    return { error: "Yalnız teslim edilmiş iş emri yeniden açılabilir" }
  }

  await prisma.$transaction(async (tx) => {
    await tx.serviceOrder.updateMany({
      where: { id: orderId, workshopId: user.workshopId, status: "delivered" },
      data: { status: "ready_for_delivery" },
    })
    await tx.vehicleIntakeForm.updateMany({
      where: { id: order.intakeFormId, workshopId: user.workshopId, status: "delivered" },
      data: { status: "ready_for_delivery" },
    })
  })

  await AuditLogAction(
    user.workshopId,
    user.id,
    "ServiceOrder",
    orderId,
    "order_reopened",
    JSON.stringify({ reason: justification, from: "delivered", to: "ready_for_delivery" }),
    orderId,
  )

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: order.intakeFormId,
    eventType: "order_reopened",
    description: "İş emri yeniden açıldı",
  })

  revalidatePath(`/orders/${orderId}`)
  revalidatePath("/orders")
  return { success: true }
}

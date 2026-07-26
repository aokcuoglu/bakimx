"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { intakeCreateSchema, intakeUpdateSchema } from "@/lib/validations/intake"
import { revalidatePath } from "next/cache"
import { AuditLogAction } from "@/lib/audit"
import { getStorageProvider, validateUploadFile, buildStoragePath } from "@/lib/storage"
import { addTimelineEvent } from "@/lib/intake/timeline"
import { isIntakeWriteLocked } from "@/lib/status-transitions"
import { nanoid } from "nanoid"
import { createServiceOrderForIntake } from "@/lib/orders/create-service-order"

export async function createIntakeAction(formData: FormData) {
  const user = await requireAuth()

  const raw = {
    customerId: formData.get("customerId") as string,
    vehicleId: formData.get("vehicleId") as string,
    mileageAtIntake: formData.get("mileageAtIntake") as string,
    customerComplaint: formData.get("customerComplaint") as string,
    internalNote: formData.get("internalNote") as string,
  }

  const parsed = intakeCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, workshopId: user.workshopId },
  })
  if (!customer) return { error: "Müşteri bulunamadı" }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: parsed.data.vehicleId, workshopId: user.workshopId },
  })
  if (!vehicle) return { error: "Araç bulunamadı" }

  // Km geriye gidemez: girilen yeni km, aracın son kayıtlı km'sinden düşük olamaz.
  // (0/boş → girilmemiş sayılır; falsy olduğu için koşula girmez.)
  if (parsed.data.mileageAtIntake && vehicle.mileage != null && parsed.data.mileageAtIntake < vehicle.mileage) {
    return { error: `Girilen kilometre aracın son kayıtlı kilometresinden (${vehicle.mileage} km) düşük olamaz.` }
  }

  const { intake, order } = await prisma.$transaction(async (tx) => {
    const intake = await tx.vehicleIntakeForm.create({
      data: {
        workshopId: user.workshopId,
        customerId: parsed.data.customerId,
        vehicleId: parsed.data.vehicleId,
        mileageAtIntake: parsed.data.mileageAtIntake || null,
        customerComplaint: parsed.data.customerComplaint,
        internalNote: parsed.data.internalNote || null,
      },
    })
    const order = await createServiceOrderForIntake(tx, user.workshopId, intake.id)
    // Aracın güncel km'sini canlı tut (km geri gitmesin); araç workshop-scoped doğrulandı.
    const km = parsed.data.mileageAtIntake
    if (km) {
      const newMileage = Math.max(vehicle.mileage ?? 0, km)
      if (newMileage !== vehicle.mileage) {
        await tx.vehicle.update({ where: { id: vehicle.id }, data: { mileage: newMileage } })
      }
    }
    return { intake, order }
  })

  await AuditLogAction(user.workshopId, user.id, "VehicleIntakeForm", intake.id, "intake_created")
  await AuditLogAction(user.workshopId, user.id, "ServiceOrder", order.id, "service_order_created")

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: intake.id,
    eventType: "intake_created",
    description: "Araç kabul formu oluşturuldu",
  })
  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: intake.id,
    eventType: "work_order_created",
    description: "İş emri oluşturuldu",
  })

  revalidatePath("/orders")
  return { success: true, id: intake.id, orderId: order.id }
}

export async function getIntakeAction(id: string) {
  const user = await requireAuth()
  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id, workshopId: user.workshopId },
    include: {
      customer: true,
      vehicle: true,
      photos: {
        select: {
          id: true,
          type: true,
          phase: true,
          label: true,
          required: true,
          fileUrl: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          storageProvider: true,
          note: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      damageMarks: true,
      approvals: { orderBy: { createdAt: "desc" }, take: 1 },
      shareLinks: { where: { isActive: true }, take: 1 },
      timelineEvents: { orderBy: { createdAt: "asc" } },
      order: { include: { items: true } },
    },
  })
  return intake
}

export async function getIntakesAction() {
  const user = await requireAuth()
  const intakes = await prisma.vehicleIntakeForm.findMany({
    where: { workshopId: user.workshopId },
    include: { customer: true, vehicle: true },
    orderBy: { createdAt: "desc" },
  })
  return intakes
}

export async function updateIntakeDetailsAction(
  intakeFormId: string,
  input: { customerComplaint: string; internalNote?: string; mileageAtIntake?: string },
) {
  const user = await requireAuth()

  const parsed = intakeUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: intakeFormId, workshopId: user.workshopId },
    include: { vehicle: true, order: { select: { status: true } } },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }
  if (isIntakeWriteLocked(intake.status, intake.order?.status)) {
    return { error: "Teslim edilmiş veya iptal edilmiş iş emrinde bilgiler düzenlenemez" }
  }

  const newComplaint = parsed.data.customerComplaint
  const newNote = parsed.data.internalNote?.trim() || null
  const newMileage = parsed.data.mileageAtIntake || null

  // Km geriye gidemez: yeni km aracın son kayıtlı km'sinden düşük olamaz.
  if (newMileage != null && intake.vehicle.mileage != null && newMileage < intake.vehicle.mileage) {
    return { error: `Girilen kilometre aracın son kayıtlı kilometresinden (${intake.vehicle.mileage} km) düşük olamaz.` }
  }

  // Sadece gerçekten değişen alanları kaydet/loglayalım (gürültüsüz denetim izi).
  const changes: string[] = []
  if (intake.customerComplaint !== newComplaint) changes.push("müşteri şikayeti")
  if ((intake.internalNote ?? null) !== newNote) changes.push("iç not")
  if ((intake.mileageAtIntake ?? null) !== newMileage) changes.push("kilometre")

  if (changes.length === 0) return { success: true }

  await prisma.$transaction(async (tx) => {
    await tx.vehicleIntakeForm.updateMany({
      where: { id: intakeFormId, workshopId: user.workshopId },
      data: {
        customerComplaint: newComplaint,
        internalNote: newNote,
        mileageAtIntake: newMileage,
      },
    })
    // Aracın güncel km'sini canlı tut (km geri gitmesin); araç workshop-scoped doğrulandı.
    if (newMileage) {
      const liveMileage = Math.max(intake.vehicle.mileage ?? 0, newMileage)
      if (liveMileage !== intake.vehicle.mileage) {
        await tx.vehicle.update({ where: { id: intake.vehicleId }, data: { mileage: liveMileage } })
      }
    }
  })

  await AuditLogAction(
    user.workshopId,
    user.id,
    "VehicleIntakeForm",
    intakeFormId,
    "intake_details_edited",
    JSON.stringify({
      fields: changes,
      before: {
        customerComplaint: intake.customerComplaint,
        internalNote: intake.internalNote,
        mileageAtIntake: intake.mileageAtIntake,
      },
      after: {
        customerComplaint: newComplaint,
        internalNote: newNote,
        mileageAtIntake: newMileage,
      },
    }),
  )

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId,
    eventType: "intake_details_edited",
    description: `İş emri bilgileri düzenlendi (${changes.join(", ")})`,
  })

  // Not: sunucu tarafı revalidate gerekmiyor — çağıran (work-order-detail.tsx)
  // başarıdan sonra router.refresh() yapıyor.
  return { success: true }
}

// DamageMark yazma yolu (ekle/sil) kaldırıldı: SVG hasar haritası Faz C'de akıştan
// çıkarıldı ve yerini PhotoAnnotate aldı; tek çağrı noktası olan /api/intakes/damage
// rotasının da hiçbir tüketicisi kalmamıştı. Mevcut DamageMark KAYITLARI okunmaya
// devam ediyor (araç detayı/pasaportu, iş emri, teknisyen, /s/[token] ve PDF) —
// delil bütünlüğü gereği kalıcıdırlar.

export async function addPhotoAction(formData: FormData) {
  const user = await requireAuth()

  const intakeFormId = formData.get("intakeFormId") as string
  const type = formData.get("type") as string
  const label = formData.get("label") as string
  const phase = formData.get("phase") as string | null
  const note = formData.get("note") as string | null
  const file = formData.get("file") as File | null

  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: intakeFormId, workshopId: user.workshopId },
    include: { order: { select: { status: true } } },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }
  if (isIntakeWriteLocked(intake.status, intake.order?.status)) {
    return { error: "Teslim edilmiş veya iptal edilmiş iş emrine fotoğraf eklenemez" }
  }

  const photoId = nanoid()
  let fileUrl: string | null = null
  let fileName: string | null = null
  let mimeType: string | null = null
  let sizeBytes: number | null = null
  let storageProvider: string | null = null
  let storageKey: string | null = null

  if (file && file.size > 0 && file.name) {
    const validation = validateUploadFile(file)
    if (!validation.valid) {
      return { error: validation.error }
    }

    try {
      const storagePath = buildStoragePath(user.workshopId, intakeFormId, type, photoId, file.name)
      const provider = await getStorageProvider()
      const result = await provider.upload(file, storagePath)

      fileUrl = result.url
      storageKey = result.key
      fileName = file.name
      mimeType = file.type
      sizeBytes = file.size
      storageProvider = process.env.STORAGE_PROVIDER || "mock"
    } catch (err) {
      const message = err instanceof Error ? err.message : "Dosya yükleme hatası"
      await AuditLogAction(user.workshopId, user.id, "VehiclePhoto", photoId, "photo_upload_error", JSON.stringify({ error: message }))
      return { error: `Fotoğraf yüklenemedi: ${message}` }
    }
  }

  const photo = await prisma.vehiclePhoto.create({
    data: {
      id: photoId,
      workshopId: user.workshopId,
      intakeFormId,
      type: type as import("@prisma/client").VehiclePhotoType,
      phase: (phase || "intake") as import("@prisma/client").PhotoPhase,
      label: label || type,
      required: false,
      fileUrl,
      fileName,
      mimeType,
      sizeBytes,
      storageProvider,
      storageKey,
      note: note || null,
    },
  })

  await AuditLogAction(user.workshopId, user.id, "VehiclePhoto", photo.id, "photo_uploaded", JSON.stringify({
    type,
    storageProvider: storageProvider || "none",
    sizeBytes,
  }))

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId,
    eventType: "photos_uploaded",
    description: `${type} fotoğrafı yüklendi`,
  })

  // Çağıranlar kendi tazelemesini yapıyor: work-order-detail.tsx router.refresh(),
  // photo-annotate.tsx yüklenen kareyi iyimser yerel state'e ekliyor.
  return { success: true, id: photo.id }
}

export async function replacePhotoAction(_formData: FormData) {
  // Delil bütünlüğü: yüklenen fotoğraflar (kanıt/hasar) değiştirilemez de silinemez de.
  // Eksikse yeni kare eklenir (addPhotoAction); eklenen kanıt kalıcıdır.
  await requireAuth()
  return { error: "Fotoğraf değiştirilemez. Kabul kanıtları kalıcıdır." }
}

export async function removePhotoAction(_photoId: string, _intakeFormId: string) {
  // Delil bütünlüğü: yüklenen fotoğraflar (kanıt/hasar) silinemez. Hatalı/bulanık
  // bir kare yeniden çekilmek istenirse replacePhotoAction (Değiştir) kullanılır.
  await requireAuth()
  return { error: "Fotoğraf silinemez. Kabul kanıtları kalıcıdır." }
}

// Kabul tarafından durum değiştirme kaldırıldı: tek çağrı noktası olan
// /api/intakes/[id]/status rotasının tüketicisi yoktu. Birleşik akışta durum
// değişimi iş emri tarafından yürüyor — /api/orders/[id]/status →
// updateOrderStatusAction (work-order-detail.tsx), o da kabul formunu aynalıyor.
"use server"

import { prisma } from "@/lib/db"
import { requireAuth, requireWritableWorkshop } from "@/lib/auth"
import { damageMarkSchema, intakeCreateSchema, intakeUpdateSchema } from "@/lib/validations/intake"
import { resolveHandoverField } from "@/lib/intake/handover"
import { revalidatePath } from "next/cache"
import { AuditLogAction } from "@/lib/audit"
import { getStorageProvider, validateUploadFile, buildStoragePath } from "@/lib/storage"
import { addTimelineEvent } from "@/lib/intake/timeline"
import { isIntakeWriteLocked } from "@/lib/status-transitions"
import { nanoid } from "nanoid"
import { createServiceOrderForIntake } from "@/lib/orders/create-service-order"
import { isArrivalReason, type ArrivalReasonKey } from "@/lib/constants"
import { VISIBLE_PHOTO } from "@/lib/intake/photo-visibility"

export async function createIntakeAction(formData: FormData) {
  const { user } = await requireWritableWorkshop("records.create")

  const raw = {
    customerId: formData.get("customerId") as string,
    vehicleId: formData.get("vehicleId") as string,
    mileageAtIntake: formData.get("mileageAtIntake") as string,
    fuelLevelAtIntake: formData.get("fuelLevelAtIntake") as string,
    customerComplaint: formData.get("customerComplaint") as string,
    internalNote: formData.get("internalNote") as string,
    arrivalReason: formData.get("arrivalReason") as string,
    droppedOffByName: formData.get("droppedOffByName") as string,
    droppedOffByPhone: formData.get("droppedOffByPhone") as string,
  }

  const parsed = intakeCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  // Tanınmayan neden sessizce yutulmaz; şema serbest string kabul ettiği için
  // asıl kontrol burada.
  const rawReason = parsed.data.arrivalReason ?? ""
  let arrivalReason: ArrivalReasonKey | null = null
  if (rawReason !== "") {
    if (!isArrivalReason(rawReason)) return { error: "Geçersiz geliş nedeni" }
    arrivalReason = rawReason
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
        // `?? null` bilinçli: 0 ("E") geçerli bir seviye, `||` onu null'a çevirirdi.
        fuelLevelAtIntake: parsed.data.fuelLevelAtIntake ?? null,
        customerComplaint: parsed.data.customerComplaint,
        internalNote: parsed.data.internalNote || null,
        // Boş bırakılırsa "müşteri aracı kendi getirdi" demektir.
        droppedOffByName: parsed.data.droppedOffByName?.trim() || null,
        droppedOffByPhone: parsed.data.droppedOffByPhone?.trim() || null,
      },
    })
    const order = await createServiceOrderForIntake(tx, user.workshopId, intake.id, arrivalReason)
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
        where: VISIBLE_PHOTO,
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
  input: {
    customerComplaint: string
    internalNote?: string
    mileageAtIntake?: string
    fuelLevelAtIntake?: number | null
    droppedOffByName?: string
    droppedOffByPhone?: string
    pickedUpByName?: string
    pickedUpByPhone?: string
  },
) {
  const { user } = await requireWritableWorkshop("order.edit")

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
  // Alan hiç gönderilmediyse (undefined) mevcut değer korunur; açıkça null
  // gönderildiyse seçim kaldırılmış demektir. 0 ("E") geçerli değerdir.
  const newFuel =
    parsed.data.fuelLevelAtIntake === undefined ? intake.fuelLevelAtIntake : parsed.data.fuelLevelAtIntake

  // Teslim eden/alan kişiler: alan gönderilmediyse korunur, boş gönderildiyse
  // temizlenir ("müşteri kendi getirdi/alacak").
  const newDropName = resolveHandoverField(parsed.data.droppedOffByName, intake.droppedOffByName)
  const newDropPhone = resolveHandoverField(parsed.data.droppedOffByPhone, intake.droppedOffByPhone)
  const newPickName = resolveHandoverField(parsed.data.pickedUpByName, intake.pickedUpByName)
  const newPickPhone = resolveHandoverField(parsed.data.pickedUpByPhone, intake.pickedUpByPhone)

  // Km geriye gidemez: yeni km aracın son kayıtlı km'sinden düşük olamaz.
  if (newMileage != null && intake.vehicle.mileage != null && newMileage < intake.vehicle.mileage) {
    return { error: `Girilen kilometre aracın son kayıtlı kilometresinden (${intake.vehicle.mileage} km) düşük olamaz.` }
  }

  // Sadece gerçekten değişen alanları kaydet/loglayalım (gürültüsüz denetim izi).
  const changes: string[] = []
  if (intake.customerComplaint !== newComplaint) changes.push("müşteri şikayeti")
  if ((intake.internalNote ?? null) !== newNote) changes.push("iç not")
  if ((intake.mileageAtIntake ?? null) !== newMileage) changes.push("kilometre")
  if ((intake.fuelLevelAtIntake ?? null) !== newFuel) changes.push("yakıt seviyesi")
  if ((intake.droppedOffByName ?? null) !== newDropName || (intake.droppedOffByPhone ?? null) !== newDropPhone) {
    changes.push("aracı getiren kişi")
  }
  if ((intake.pickedUpByName ?? null) !== newPickName || (intake.pickedUpByPhone ?? null) !== newPickPhone) {
    changes.push("aracı teslim alacak kişi")
  }

  if (changes.length === 0) return { success: true }

  await prisma.$transaction(async (tx) => {
    await tx.vehicleIntakeForm.updateMany({
      where: { id: intakeFormId, workshopId: user.workshopId },
      data: {
        customerComplaint: newComplaint,
        internalNote: newNote,
        mileageAtIntake: newMileage,
        fuelLevelAtIntake: newFuel,
        droppedOffByName: newDropName,
        droppedOffByPhone: newDropPhone,
        pickedUpByName: newPickName,
        pickedUpByPhone: newPickPhone,
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
        fuelLevelAtIntake: intake.fuelLevelAtIntake,
        droppedOffByName: intake.droppedOffByName,
        droppedOffByPhone: intake.droppedOffByPhone,
        pickedUpByName: intake.pickedUpByName,
        pickedUpByPhone: intake.pickedUpByPhone,
      },
      after: {
        customerComplaint: newComplaint,
        internalNote: newNote,
        mileageAtIntake: newMileage,
        fuelLevelAtIntake: newFuel,
        droppedOffByName: newDropName,
        droppedOffByPhone: newDropPhone,
        pickedUpByName: newPickName,
        pickedUpByPhone: newPickPhone,
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

export async function addDamageMarkAction(input: unknown) {
  const { user } = await requireWritableWorkshop("records.create")
  const parsed = damageMarkSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Hasar bilgileri geçersiz" }

  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: parsed.data.intakeFormId, workshopId: user.workshopId },
    include: { order: { select: { id: true, status: true } } },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }
  if (isIntakeWriteLocked(intake.status, intake.order?.status)) return { error: "Kapalı iş emrine hasar eklenemez" }

  const mark = await prisma.damageMark.create({
    data: { workshopId: user.workshopId, intakeFormId: intake.id, zone: parsed.data.zone, damageType: parsed.data.damageType, severity: parsed.data.severity, note: parsed.data.note || null },
  })
  await AuditLogAction(user.workshopId, user.id, "DamageMark", mark.id, "damage_mark_added", JSON.stringify(parsed.data), intake.order?.id)
  return { success: true, mark: { id: mark.id, zone: mark.zone, damageType: mark.damageType, severity: mark.severity, note: mark.note } }
}

export async function removeDamageMarkAction(id: string) {
  const { user } = await requireWritableWorkshop("order.edit")
  const mark = await prisma.damageMark.findFirst({
    where: { id, workshopId: user.workshopId },
    include: { intakeForm: { include: { order: { select: { id: true, status: true } } } } },
  })
  if (!mark) return { error: "Hasar kaydı bulunamadı" }
  if (isIntakeWriteLocked(mark.intakeForm.status, mark.intakeForm.order?.status)) return { error: "Kapalı iş emrindeki hasar kaldırılamaz" }
  await prisma.damageMark.delete({ where: { id: mark.id } })
  await AuditLogAction(user.workshopId, user.id, "DamageMark", mark.id, "damage_mark_removed", JSON.stringify({ zone: mark.zone, damageType: mark.damageType, severity: mark.severity, note: mark.note }), mark.intakeForm.order?.id)
  return { success: true }
}

export async function addPhotoAction(formData: FormData) {
  const { user } = await requireWritableWorkshop("records.create")

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
  // Yerinde DEĞİŞTİRME hâlâ kapalı: bir karenin içeriğini sessizce başkasıyla
  // takas etmek denetim izini bozar. Hatalı kare `removePhotoAction` ile (soft,
  // loglu) kaldırılır ve yerine `addPhotoAction` ile yeni kare eklenir.
  await requireAuth()
  return { error: "Fotoğraf değiştirilemez. Hatalı kareyi silip yenisini ekleyin." }
}

/**
 * Yanlış/bulanık kareyi galeriden kaldırır. Silme SOFT'tur: satır ve depodaki
 * dosya olduğu gibi kalır, yalnızca `deletedAt` işaretlenir — böylece delil
 * bütünlüğü korunurken hatalı kare müşteriye/PDF'e yansımaz. Kim, ne zaman
 * sildiği `deletedById` + AuditLog `photo_deleted` kaydında durur.
 *
 * Teslim edilmiş/iptal edilmiş iş emrinde kilitli (fotoğraf EKLEME ile aynı
 * kural). Public timeline'a olay YAZILMAZ: silme dahili bir düzeltmedir.
 */
export async function removePhotoAction(photoId: string) {
  const { user } = await requireWritableWorkshop("order.edit")

  if (!photoId) return { error: "Fotoğraf bulunamadı" }

  const photo = await prisma.vehiclePhoto.findFirst({
    where: { id: photoId, workshopId: user.workshopId },
    include: {
      intakeForm: { select: { id: true, status: true, order: { select: { id: true, status: true } } } },
    },
  })
  if (!photo) return { error: "Fotoğraf bulunamadı" }
  if (photo.deletedAt) return { success: true }

  if (isIntakeWriteLocked(photo.intakeForm.status, photo.intakeForm.order?.status)) {
    return { error: "Teslim edilmiş veya iptal edilmiş iş emrinin fotoğrafı silinemez" }
  }

  await prisma.vehiclePhoto.update({
    where: { id: photo.id },
    data: { deletedAt: new Date(), deletedById: user.id },
  })

  await AuditLogAction(
    user.workshopId,
    user.id,
    "VehiclePhoto",
    photo.id,
    "photo_deleted",
    JSON.stringify({
      type: photo.type,
      label: photo.label,
      phase: photo.phase,
      fileName: photo.fileName,
      storageKey: photo.storageKey,
      intakeFormId: photo.intakeFormId,
      serviceOrderItemId: photo.serviceOrderItemId,
    }),
    photo.intakeForm.order?.id
  )

  // Çağıranlar başarıdan sonra kendi router.refresh()'ini yapıyor.
  return { success: true }
}

// Kabul tarafından durum değiştirme kaldırıldı: tek çağrı noktası olan
// /api/intakes/[id]/status rotasının tüketicisi yoktu. Birleşik akışta durum
// değişimi iş emri tarafından yürüyor — /api/orders/[id]/status →
// updateOrderStatusAction (work-order-detail.tsx), o da kabul formunu aynalıyor.

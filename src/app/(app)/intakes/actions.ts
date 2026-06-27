"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { intakeCreateSchema, intakeUpdateSchema, damageMarkSchema } from "@/lib/validations/intake"
import { revalidatePath } from "next/cache"
import { AuditLogAction } from "@/lib/audit"
import { getStorageProvider, validateUploadFile, buildStoragePath } from "@/lib/storage"
import { addTimelineEvent } from "@/lib/intake/timeline"
import { isIntakeStatus, canTransitionIntake } from "@/lib/status-transitions"
import type { IntakeStatus } from "@prisma/client"
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

  revalidatePath("/intakes")
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
    include: { vehicle: true },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }

  const newComplaint = parsed.data.customerComplaint
  const newNote = parsed.data.internalNote?.trim() || null
  const newMileage = parsed.data.mileageAtIntake || null

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

  revalidatePath(`/intakes/${intakeFormId}`)
  revalidatePath("/intakes")
  return { success: true }
}

export async function addDamageMarkAction(formData: FormData) {
  const user = await requireAuth()

  const raw = {
    intakeFormId: formData.get("intakeFormId") as string,
    zone: formData.get("zone") as string,
    damageType: formData.get("damageType") as string,
    severity: formData.get("severity") as string,
    note: formData.get("note") as string,
    photoUrl: formData.get("photoUrl") as string,
  }

  const parsed = damageMarkSchema.safeParse({
    zone: raw.zone,
    damageType: raw.damageType,
    severity: raw.severity,
    note: raw.note || undefined,
    photoUrl: raw.photoUrl || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz hasar bilgisi" }
  }

  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: raw.intakeFormId, workshopId: user.workshopId },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }

  const mark = await prisma.damageMark.create({
    data: {
      workshopId: user.workshopId,
      intakeFormId: raw.intakeFormId,
      zone: parsed.data.zone,
      damageType: parsed.data.damageType,
      severity: parsed.data.severity,
      note: parsed.data.note || null,
      photoUrl: parsed.data.photoUrl || null,
    },
  })

  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId: raw.intakeFormId,
    eventType: "damage_marks_added",
    description: `Hasar kaydı: ${parsed.data.zone} - ${parsed.data.damageType}`,
  })

  revalidatePath(`/intakes/${raw.intakeFormId}`)
  return { success: true, id: mark.id }
}

export async function removeDamageMarkAction(_markId: string, _intakeFormId: string) {
  // Delil bütünlüğü: kabul sırasında kaydedilen hasar işaretleri silinemez.
  // İş emri metni düzenlenebilir (updateIntakeDetailsAction) ama kanıt kalıcıdır.
  await requireAuth()
  return { error: "Hasar kaydı silinemez. Kabul kanıtları kalıcıdır." }
}

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
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }

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

  revalidatePath(`/intakes/${intakeFormId}`)
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

export async function updateIntakeStatusAction(intakeFormId: string, status: string) {
  const user = await requireAuth()

  if (!isIntakeStatus(status)) return { error: "Geçersiz durum" }

  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: intakeFormId, workshopId: user.workshopId },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }

  // `approved` is reachable only through the customer OTP flow (verifyOtpAction);
  // block any attempt to set it (or make an illegal jump) via the generic action.
  if (!canTransitionIntake(intake.status as IntakeStatus, status)) {
    return {
      error:
        status === "approved"
          ? "Onay yalnızca müşteri doğrulaması (OTP) ile verilebilir"
          : "Bu durum geçişine izin verilmiyor",
    }
  }

  const updateResult = await prisma.vehicleIntakeForm.updateMany({
    where: { id: intakeFormId, workshopId: user.workshopId },
    data: { status },
  })
  if (updateResult.count === 0) return { error: "Kabul formu bulunamadı" }

  await AuditLogAction(user.workshopId, user.id, "VehicleIntakeForm", intakeFormId, `status_changed_to_${status}`)

  revalidatePath(`/intakes/${intakeFormId}`)
  revalidatePath("/intakes")
  return { success: true }
}
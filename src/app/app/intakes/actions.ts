"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { intakeCreateSchema, damageMarkSchema } from "@/lib/validation"
import { revalidatePath } from "next/cache"
import { AuditLogAction } from "@/lib/audit"

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

  const intake = await prisma.vehicleIntakeForm.create({
    data: {
      workshopId: user.workshopId,
      customerId: parsed.data.customerId,
      vehicleId: parsed.data.vehicleId,
      mileageAtIntake: parsed.data.mileageAtIntake || null,
      customerComplaint: parsed.data.customerComplaint,
      internalNote: parsed.data.internalNote || null,
    },
  })

  await AuditLogAction(user.workshopId, user.id, "VehicleIntakeForm", intake.id, "intake_created")

  revalidatePath("/app/intakes")
  return { success: true, id: intake.id }
}

export async function getIntakeAction(id: string) {
  const user = await requireAuth()
  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id, workshopId: user.workshopId },
    include: {
      customer: true,
      vehicle: true,
      photos: true,
      damageMarks: true,
      approvals: { orderBy: { createdAt: "desc" }, take: 1 },
      shareLinks: { where: { isActive: true }, take: 1 },
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

  revalidatePath(`/app/intakes/${raw.intakeFormId}`)
  return { success: true, id: mark.id }
}

export async function removeDamageMarkAction(markId: string, intakeFormId: string) {
  const user = await requireAuth()

  const mark = await prisma.damageMark.findFirst({
    where: { id: markId, workshopId: user.workshopId },
  })
  if (!mark) return { error: "Hasar işareti bulunamadı" }

  const deleteResult = await prisma.damageMark.deleteMany({
    where: { id: markId, workshopId: user.workshopId },
  })
  if (deleteResult.count === 0) return { error: "Hasar işareti bulunamadı" }

  revalidatePath(`/app/intakes/${intakeFormId}`)
  return { success: true }
}

export async function addPhotoAction(formData: FormData) {
  const user = await requireAuth()

  const intakeFormId = formData.get("intakeFormId") as string
  const type = formData.get("type") as string
  const label = formData.get("label") as string
  const fileUrl = formData.get("fileUrl") as string
  const note = formData.get("note") as string

  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: intakeFormId, workshopId: user.workshopId },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }

  const photo = await prisma.vehiclePhoto.create({
    data: {
      workshopId: user.workshopId,
      intakeFormId,
      type: type as import("@prisma/client").VehiclePhotoType,
      label: label || type,
      required: false,
      fileUrl: fileUrl || null,
      note: note || null,
    },
  })

  revalidatePath(`/app/intakes/${intakeFormId}`)
  return { success: true, id: photo.id }
}

export async function removePhotoAction(photoId: string, intakeFormId: string) {
  const user = await requireAuth()

  const photo = await prisma.vehiclePhoto.findFirst({
    where: { id: photoId, workshopId: user.workshopId },
  })
  if (!photo) return { error: "Fotoğraf bulunamadı" }

  const deleteResult = await prisma.vehiclePhoto.deleteMany({
    where: { id: photoId, workshopId: user.workshopId },
  })
  if (deleteResult.count === 0) return { error: "Fotoğraf bulunamadı" }

  revalidatePath(`/app/intakes/${intakeFormId}`)
  return { success: true }
}

export async function updateIntakeStatusAction(intakeFormId: string, status: string) {
  const user = await requireAuth()

  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: intakeFormId, workshopId: user.workshopId },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }

  const updateResult = await prisma.vehicleIntakeForm.updateMany({
    where: { id: intakeFormId, workshopId: user.workshopId },
    data: { status: status as import("@prisma/client").IntakeStatus },
  })
  if (updateResult.count === 0) return { error: "Kabul formu bulunamadı" }

  await AuditLogAction(user.workshopId, user.id, "VehicleIntakeForm", intakeFormId, `status_changed_to_${status}`)

  revalidatePath(`/app/intakes/${intakeFormId}`)
  revalidatePath("/app/intakes")
  return { success: true }
}
"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import {
  businessProfileSchema,
  brandingSchema,
  communicationSettingsSchema,
  workingHoursSchema,
  appointmentRulesSchema,
  pdfTemplateSchema,
} from "@/lib/validation"

async function auditLog(workshopId: string, actorUserId: string | null, action: string, entityType: string) {
  await prisma.auditLog.create({
    data: {
      workshopId,
      actorUserId,
      entityType,
      entityId: workshopId,
      action,
    },
  })
}

export async function getWorkshopSettings() {
  const user = await requireAuth()

  const workshop = await prisma.workshop.findUnique({
    where: { id: user.workshopId },
  })

  let settings = await prisma.workshopSettings.findUnique({
    where: { workshopId: user.workshopId },
  })

  if (!settings) {
    settings = await prisma.workshopSettings.create({
      data: { workshopId: user.workshopId },
    })
  }

  return { workshop, settings, workshopId: user.workshopId }
}

export async function updateBusinessProfileAction(formData: FormData) {
  const user = await requireAuth()

  const raw = {
    name: formData.get("name") as string,
    phone: formData.get("phone") as string,
    city: formData.get("city") as string,
    district: formData.get("district") as string,
    address: formData.get("address") as string,
    email: formData.get("email") as string,
    website: formData.get("website") as string,
    taxNumber: formData.get("taxNumber") as string,
    taxOffice: formData.get("taxOffice") as string,
    invoiceTitle: formData.get("invoiceTitle") as string,
    logoUrl: formData.get("logoUrl") as string,
  }

  const parsed = businessProfileSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  await prisma.workshop.update({
    where: { id: user.workshopId },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      city: parsed.data.city,
      district: parsed.data.district || null,
      address: parsed.data.address,
      email: parsed.data.email || null,
      website: parsed.data.website || null,
      taxNumber: parsed.data.taxNumber || null,
      taxOffice: parsed.data.taxOffice || null,
      invoiceTitle: parsed.data.invoiceTitle || null,
      logoUrl: parsed.data.logoUrl || null,
    },
  })

  await auditLog(user.workshopId, user.id, "update_business_profile", "Workshop")

  revalidatePath("/app/settings")
  return { success: true }
}

export async function updateBrandingAction(formData: FormData) {
  const user = await requireAuth()

  const raw = {
    pdfLogoUrl: formData.get("pdfLogoUrl") as string,
    publicPortalLogoUrl: formData.get("publicPortalLogoUrl") as string,
    passportLogoUrl: formData.get("passportLogoUrl") as string,
    themeColor: formData.get("themeColor") as string,
    accentColor: formData.get("accentColor") as string,
  }

  const parsed = brandingSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  await prisma.workshopSettings.upsert({
    where: { workshopId: user.workshopId },
    update: {
      pdfLogoUrl: parsed.data.pdfLogoUrl || null,
      publicPortalLogoUrl: parsed.data.publicPortalLogoUrl || null,
      passportLogoUrl: parsed.data.passportLogoUrl || null,
      themeColor: parsed.data.themeColor || null,
      accentColor: parsed.data.accentColor || null,
    },
    create: {
      workshopId: user.workshopId,
      pdfLogoUrl: parsed.data.pdfLogoUrl || null,
      publicPortalLogoUrl: parsed.data.publicPortalLogoUrl || null,
      passportLogoUrl: parsed.data.passportLogoUrl || null,
      themeColor: parsed.data.themeColor || null,
      accentColor: parsed.data.accentColor || null,
    },
  })

  await auditLog(user.workshopId, user.id, "update_branding", "WorkshopSettings")

  revalidatePath("/app/settings")
  return { success: true }
}

export async function updateCommunicationSettingsAction(formData: FormData) {
  const user = await requireAuth()

  const raw = {
    smsProvider: formData.get("smsProvider") as string,
    smsApiKey: formData.get("smsApiKey") as string,
    smsSenderName: formData.get("smsSenderName") as string,
    whatsappProvider: formData.get("whatsappProvider") as string,
    whatsappApiKey: formData.get("whatsappApiKey") as string,
    whatsappPhoneNumber: formData.get("whatsappPhoneNumber") as string,
    emailProvider: formData.get("emailProvider") as string,
    emailApiKey: formData.get("emailApiKey") as string,
    emailFromAddress: formData.get("emailFromAddress") as string,
    emailFromName: formData.get("emailFromName") as string,
  }

  const parsed = communicationSettingsSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  const updateData: Record<string, unknown> = {
    smsProvider: parsed.data.smsProvider,
    smsSenderName: parsed.data.smsSenderName || null,
    whatsappProvider: parsed.data.whatsappProvider,
    whatsappPhoneNumber: parsed.data.whatsappPhoneNumber || null,
    emailProvider: parsed.data.emailProvider,
    emailFromAddress: parsed.data.emailFromAddress || null,
    emailFromName: parsed.data.emailFromName || null,
  }
  if (parsed.data.smsApiKey) updateData.smsApiKey = parsed.data.smsApiKey
  if (parsed.data.whatsappApiKey) updateData.whatsappApiKey = parsed.data.whatsappApiKey
  if (parsed.data.emailApiKey) updateData.emailApiKey = parsed.data.emailApiKey

  await prisma.workshopSettings.upsert({
    where: { workshopId: user.workshopId },
    update: updateData,
    create: {
      workshopId: user.workshopId,
      smsProvider: parsed.data.smsProvider,
      smsApiKey: parsed.data.smsApiKey || null,
      smsSenderName: parsed.data.smsSenderName || null,
      whatsappProvider: parsed.data.whatsappProvider,
      whatsappApiKey: parsed.data.whatsappApiKey || null,
      whatsappPhoneNumber: parsed.data.whatsappPhoneNumber || null,
      emailProvider: parsed.data.emailProvider,
      emailApiKey: parsed.data.emailApiKey || null,
      emailFromAddress: parsed.data.emailFromAddress || null,
      emailFromName: parsed.data.emailFromName || null,
    },
  })

  await auditLog(user.workshopId, user.id, "update_communication_settings", "WorkshopSettings")

  revalidatePath("/app/settings")
  return { success: true }
}

export async function updateWorkingHoursAction(formData: FormData) {
  const user = await requireAuth()

  const raw = {
    weekdayStart: formData.get("weekdayStart") as string,
    weekdayEnd: formData.get("weekdayEnd") as string,
    weekdayWorkingDays: formData.get("weekdayWorkingDays") as string,
    weekendStart: formData.get("weekendStart") as string,
    weekendEnd: formData.get("weekendEnd") as string,
    weekendWorkingDays: formData.get("weekendWorkingDays") as string,
    holidayEnabled: formData.get("holidayEnabled") as string,
    holidayDates: formData.get("holidayDates") as string,
  }

  const parsed = workingHoursSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  await prisma.workshopSettings.upsert({
    where: { workshopId: user.workshopId },
    update: {
      weekdayStart: parsed.data.weekdayStart,
      weekdayEnd: parsed.data.weekdayEnd,
      weekdayWorkingDays: parsed.data.weekdayWorkingDays,
      weekendStart: parsed.data.weekendStart,
      weekendEnd: parsed.data.weekendEnd,
      weekendWorkingDays: parsed.data.weekendWorkingDays,
      holidayEnabled: parsed.data.holidayEnabled,
      holidayDates: parsed.data.holidayDates || null,
    },
    create: {
      workshopId: user.workshopId,
      weekdayStart: parsed.data.weekdayStart,
      weekdayEnd: parsed.data.weekdayEnd,
      weekdayWorkingDays: parsed.data.weekdayWorkingDays,
      weekendStart: parsed.data.weekendStart,
      weekendEnd: parsed.data.weekendEnd,
      weekendWorkingDays: parsed.data.weekendWorkingDays,
      holidayEnabled: parsed.data.holidayEnabled,
      holidayDates: parsed.data.holidayDates || null,
    },
  })

  await auditLog(user.workshopId, user.id, "update_working_hours", "WorkshopSettings")

  revalidatePath("/app/settings")
  return { success: true }
}

export async function updateAppointmentRulesAction(formData: FormData) {
  const user = await requireAuth()

  const raw = {
    defaultAppointmentDuration: formData.get("defaultAppointmentDuration") as string,
    bufferDuration: formData.get("bufferDuration") as string,
    reminderTimings: formData.get("reminderTimings") as string,
  }

  const parsed = appointmentRulesSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  await prisma.workshopSettings.upsert({
    where: { workshopId: user.workshopId },
    update: {
      defaultAppointmentDuration: parsed.data.defaultAppointmentDuration,
      bufferDuration: parsed.data.bufferDuration,
      reminderTimings: parsed.data.reminderTimings,
    },
    create: {
      workshopId: user.workshopId,
      defaultAppointmentDuration: parsed.data.defaultAppointmentDuration,
      bufferDuration: parsed.data.bufferDuration,
      reminderTimings: parsed.data.reminderTimings,
    },
  })

  await auditLog(user.workshopId, user.id, "update_appointment_rules", "WorkshopSettings")

  revalidatePath("/app/settings")
  return { success: true }
}

export async function updatePdfTemplateAction(formData: FormData) {
  const user = await requireAuth()

  const raw = {
    workOrderTemplate: formData.get("workOrderTemplate") as string,
    servicePassportTemplate: formData.get("servicePassportTemplate") as string,
    collectionReceiptTemplate: formData.get("collectionReceiptTemplate") as string,
  }

  const parsed = pdfTemplateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  await prisma.workshopSettings.upsert({
    where: { workshopId: user.workshopId },
    update: {
      workOrderTemplate: parsed.data.workOrderTemplate || null,
      servicePassportTemplate: parsed.data.servicePassportTemplate || null,
      collectionReceiptTemplate: parsed.data.collectionReceiptTemplate || null,
    },
    create: {
      workshopId: user.workshopId,
      workOrderTemplate: parsed.data.workOrderTemplate || null,
      servicePassportTemplate: parsed.data.servicePassportTemplate || null,
      collectionReceiptTemplate: parsed.data.collectionReceiptTemplate || null,
    },
  })

  await auditLog(user.workshopId, user.id, "update_pdf_templates", "WorkshopSettings")

  revalidatePath("/app/settings")
  return { success: true }
}
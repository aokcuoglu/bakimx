"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { getCurrentUser, assertWorkshopAccess } from "@/lib/auth"
import { reminderCreateSchema } from "@/lib/validations/reminder"
import { getValidationError } from "@/lib/validations/shared"
import { AuditLogAction } from "@/lib/audit"
import { deriveReminderStatus } from "@/lib/reminders/status"
import { notifyMaintenanceReminder } from "@/lib/communications/triggers"
import { syncMaintenanceReminderToCalendar } from "@/lib/calendar/sync"
import type { MaintenanceReminderStatus, MaintenanceReminderType, MaintenanceChannel } from "@prisma/client"

export async function createReminderAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const raw = {
    customerId: formData.get("customerId") as string,
    vehicleId: formData.get("vehicleId") as string,
    title: formData.get("title") as string,
    type: formData.get("type") as string,
    dueDate: formData.get("dueDate") as string,
    dueMileage: formData.get("dueMileage") as string,
    currentMileage: formData.get("currentMileage") as string,
    lastServiceDate: formData.get("lastServiceDate") as string,
    lastServiceMileage: formData.get("lastServiceMileage") as string,
    reminderDaysBefore: formData.get("reminderDaysBefore") as string,
    reminderKmBefore: formData.get("reminderKmBefore") as string,
    preferredChannel: formData.get("preferredChannel") as string,
    customerNote: formData.get("customerNote") as string,
    internalNote: formData.get("internalNote") as string,
  }

  const parsed = reminderCreateSchema.safeParse(raw)
  const error = getValidationError(parsed)
  if (error) {
    throw new Error(error)
  }

  const data = parsed.data!

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, workshopId: user.workshopId },
  })
  assertWorkshopAccess(customer, user.workshopId, "Müşteri")

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: data.vehicleId, workshopId: user.workshopId },
  })
  assertWorkshopAccess(vehicle, user.workshopId, "Araç")

  const dueDate = data.dueDate && data.dueDate.trim() ? new Date(data.dueDate) : null
  const dueMileage = data.dueMileage != null && data.dueMileage !== "" ? Number(data.dueMileage) : null
  const currentMileage = data.currentMileage != null && data.currentMileage !== "" ? Number(data.currentMileage) : null
  const lastServiceDate = data.lastServiceDate && data.lastServiceDate.trim() ? new Date(data.lastServiceDate) : null
  const lastServiceMileage = data.lastServiceMileage != null && data.lastServiceMileage !== "" ? Number(data.lastServiceMileage) : null
  const reminderDaysBefore = data.reminderDaysBefore != null && data.reminderDaysBefore !== "" ? Number(data.reminderDaysBefore) : null
  const reminderKmBefore = data.reminderKmBefore != null && data.reminderKmBefore !== "" ? Number(data.reminderKmBefore) : null

  const computedStatus = deriveReminderStatus({
    dueDate,
    dueMileage,
    currentMileage,
    reminderDaysBefore,
    reminderKmBefore,
  })

  const reminder = await prisma.maintenanceReminder.create({
    data: {
      workshopId: user.workshopId,
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      title: data.title,
      type: data.type as MaintenanceReminderType,
      status: computedStatus as MaintenanceReminderStatus,
      dueDate,
      dueMileage,
      currentMileage,
      lastServiceDate,
      lastServiceMileage,
      reminderDaysBefore,
      reminderKmBefore,
      preferredChannel: (data.preferredChannel || "none") as MaintenanceChannel,
      customerNote: data.customerNote || null,
      internalNote: data.internalNote || null,
    },
  })

  await AuditLogAction(user.workshopId, user.id, "MaintenanceReminder", reminder.id, "created", JSON.stringify({ title: data.title }))

  if (data.preferredChannel && data.preferredChannel !== "none" && (data.dueDate || data.dueMileage)) {
    try {
      const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, workshopId: user.workshopId } })
      await notifyMaintenanceReminder(
        user.workshopId,
        data.customerId,
        vehicle?.plate || null,
        data.title,
        dueDate ? dueDate.toISOString() : null,
        reminder.id,
      )
    } catch (e) {
      console.error("[notifyMaintenanceReminder] Bakım hatırlatma bildirimi gönderilemedi:", e)
    }
  }

  if (dueDate) {
    try {
      await syncMaintenanceReminderToCalendar(reminder.id, user.workshopId)
    } catch (e) {
      console.error("[syncMaintenanceReminderToCalendar] Bakım takvim senkronizasyonu başarısız:", e)
    }
  }

  revalidatePath("/reminders")
  redirect(`/reminders/${reminder.id}`)
}

export async function updateReminderAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const id = formData.get("id") as string
  if (!id) throw new Error("Hatırlatma ID gerekli")

  const existing = assertWorkshopAccess(await prisma.maintenanceReminder.findFirst({
    where: { id, workshopId: user.workshopId },
  }), user.workshopId, "Hatırlatma")

  const raw = {
    customerId: formData.get("customerId") as string,
    vehicleId: formData.get("vehicleId") as string,
    title: formData.get("title") as string,
    type: formData.get("type") as string,
    dueDate: formData.get("dueDate") as string,
    dueMileage: formData.get("dueMileage") as string,
    currentMileage: formData.get("currentMileage") as string,
    lastServiceDate: formData.get("lastServiceDate") as string,
    lastServiceMileage: formData.get("lastServiceMileage") as string,
    reminderDaysBefore: formData.get("reminderDaysBefore") as string,
    reminderKmBefore: formData.get("reminderKmBefore") as string,
    preferredChannel: formData.get("preferredChannel") as string,
    customerNote: formData.get("customerNote") as string,
    internalNote: formData.get("internalNote") as string,
  }

  const parsed = reminderCreateSchema.safeParse(raw)
  const error = getValidationError(parsed)
  if (error) throw new Error(error)

  const data = parsed.data!

  const dueDate = data.dueDate && data.dueDate.trim() ? new Date(data.dueDate) : null
  const dueMileage = data.dueMileage != null && data.dueMileage !== "" ? Number(data.dueMileage) : null
  const currentMileage = data.currentMileage != null && data.currentMileage !== "" ? Number(data.currentMileage) : null
  const lastServiceDate = data.lastServiceDate && data.lastServiceDate.trim() ? new Date(data.lastServiceDate) : null
  const lastServiceMileage = data.lastServiceMileage != null && data.lastServiceMileage !== "" ? Number(data.lastServiceMileage) : null
  const reminderDaysBefore = data.reminderDaysBefore != null && data.reminderDaysBefore !== "" ? Number(data.reminderDaysBefore) : null
  const reminderKmBefore = data.reminderKmBefore != null && data.reminderKmBefore !== "" ? Number(data.reminderKmBefore) : null

      const computedStatus: MaintenanceReminderStatus = ["completed", "postponed", "cancelled"].includes(existing.status)
    ? existing.status as MaintenanceReminderStatus
    : deriveReminderStatus({
        dueDate,
        dueMileage,
        currentMileage,
        reminderDaysBefore,
        reminderKmBefore,
      }) as MaintenanceReminderStatus

  await prisma.maintenanceReminder.update({
    where: { id },
    data: {
      customerId: data.customerId,
      vehicleId: data.vehicleId,
      title: data.title,
      type: data.type as MaintenanceReminderType,
      status: computedStatus,
      dueDate,
      dueMileage,
      currentMileage,
      lastServiceDate,
      lastServiceMileage,
      reminderDaysBefore,
      reminderKmBefore,
      preferredChannel: (data.preferredChannel || "none") as MaintenanceChannel,
      customerNote: data.customerNote || null,
      internalNote: data.internalNote || null,
    },
  })

  await AuditLogAction(user.workshopId, user.id, "MaintenanceReminder", id, "updated", JSON.stringify({ title: data.title }))

  revalidatePath("/reminders")
  revalidatePath(`/reminders/${id}`)
  redirect(`/reminders/${id}`)
}

export async function completeReminderAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const id = formData.get("id") as string
  if (!id) throw new Error("Hatırlatma ID gerekli")

  assertWorkshopAccess(await prisma.maintenanceReminder.findFirst({
    where: { id, workshopId: user.workshopId },
  }), user.workshopId, "Hatırlatma")

  await prisma.maintenanceReminder.update({
    where: { id },
    data: {
      status: "completed",
      completedAt: new Date(),
    },
  })

  await AuditLogAction(user.workshopId, user.id, "MaintenanceReminder", id, "completed")

  revalidatePath("/reminders")
  revalidatePath(`/reminders/${id}`)
}

export async function postponeReminderAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const id = formData.get("id") as string
  const newDueDate = formData.get("dueDate") as string
  const newDueMileage = formData.get("dueMileage") as string

  if (!id) throw new Error("Hatırlatma ID gerekli")
  if (!newDueDate && !newDueMileage) throw new Error("Yeni tarih veya KM gerekli")

  assertWorkshopAccess(await prisma.maintenanceReminder.findFirst({
    where: { id, workshopId: user.workshopId },
  }), user.workshopId, "Hatırlatma")

  const updateData: Record<string, unknown> = { status: "postponed" as MaintenanceReminderStatus }
  if (newDueDate) updateData.dueDate = new Date(newDueDate)
  if (newDueMileage) updateData.dueMileage = Number(newDueMileage)

  await prisma.maintenanceReminder.update({ where: { id }, data: updateData })

  await AuditLogAction(user.workshopId, user.id, "MaintenanceReminder", id, "postponed", JSON.stringify({ newDueDate, newDueMileage }))

  revalidatePath("/reminders")
  revalidatePath(`/reminders/${id}`)
}

export async function cancelReminderAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const id = formData.get("id") as string
  if (!id) throw new Error("Hatırlatma ID gerekli")

  assertWorkshopAccess(await prisma.maintenanceReminder.findFirst({
    where: { id, workshopId: user.workshopId },
  }), user.workshopId, "Hatırlatma")

  await prisma.maintenanceReminder.update({
    where: { id },
    data: { status: "cancelled" },
  })

  await AuditLogAction(user.workshopId, user.id, "MaintenanceReminder", id, "cancelled")

  revalidatePath("/reminders")
  revalidatePath(`/reminders/${id}`)
}

export async function createAppointmentFromReminderAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Unauthorized")

  const id = formData.get("id") as string
  if (!id) throw new Error("Hatırlatma ID gerekli")

  const existing = assertWorkshopAccess(await prisma.maintenanceReminder.findFirst({
    where: { id, workshopId: user.workshopId },
  }), user.workshopId, "Hatırlatma")

  if (existing.createdAppointmentId) {
    return { redirect: `/appointments/${existing.createdAppointmentId}`, error: "Bu hatırlatma için zaten randevu oluşturulmuş" }
  }

  const appointment = await prisma.appointment.create({
    data: {
      workshopId: user.workshopId,
      customerId: existing.customerId,
      vehicleId: existing.vehicleId,
      title: `Bakım: ${existing.title}`,
      customerRequest: existing.customerNote || existing.title,
      appointmentAt: existing.dueDate || new Date(Date.now() + 86400000 * 7),
      status: "scheduled",
    },
  })

  await prisma.maintenanceReminder.update({
    where: { id },
    data: { createdAppointmentId: appointment.id },
  })

  await AuditLogAction(user.workshopId, user.id, "MaintenanceReminder", id, "appointment_created", JSON.stringify({ appointmentId: appointment.id }))

  revalidatePath(`/reminders/${id}`)
  return { redirect: `/appointments/${appointment.id}` }
}

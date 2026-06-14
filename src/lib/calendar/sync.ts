import { prisma } from "@/lib/db"
import { getCalendarProvider } from "@/lib/calendar"
import type { CalendarEvent } from "@/lib/calendar/types"
import { AuditLogAction } from "@/lib/audit"

export async function syncAppointmentToCalendar(appointmentId: string, workshopId: string): Promise<{ success: boolean; externalEventId?: string; error?: string }> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      customer: { select: { firstName: true, lastName: true, fullName: true, companyName: true } },
      vehicle: { select: { plate: true, brand: true, model: true } },
    },
  })

  if (!appointment) {
    return { success: false, error: "Appointment not found" }
  }

  const customerName = appointment.customer.fullName || appointment.customer.companyName || [appointment.customer.firstName, appointment.customer.lastName].filter(Boolean).join(" ")
  const vehicleInfo = appointment.vehicle ? `${appointment.vehicle.plate} ${appointment.vehicle.brand || ""} ${appointment.vehicle.model || ""}`.trim() : ""
  const title = appointment.title || `Randevu: ${customerName}${vehicleInfo ? ` - ${vehicleInfo}` : ""}`
  const endAt = appointment.estimatedDurationMinutes
    ? new Date(appointment.appointmentAt.getTime() + appointment.estimatedDurationMinutes * 60 * 1000)
    : undefined

  const event: CalendarEvent = {
    id: appointment.id,
    title,
    description: appointment.customerRequest || appointment.internalNote || undefined,
    startAt: appointment.appointmentAt,
    endAt,
    type: "appointment",
    entityId: appointment.id,
    workshopId,
  }

  const provider = getCalendarProvider()
  const result = await provider.createEvent(event)

  await prisma.calendarSyncLog.create({
    data: {
      workshopId,
      provider: process.env.CALENDAR_PROVIDER || "mock",
      direction: "outbound",
      status: result.success ? "success" : "failed",
      eventType: "appointment",
      entityId: appointment.id,
      externalEventId: result.externalEventId,
      errorMessage: result.error,
    },
  })

  if (result.success) {
    await AuditLogAction(workshopId, undefined, "appointment", appointment.id, "calendar_synced", JSON.stringify({ externalEventId: result.externalEventId }))
  }

  return result
}

export async function syncDeliveryToCalendar(orderId: string, workshopId: string): Promise<{ success: boolean; externalEventId?: string; error?: string }> {
  const order = await prisma.serviceOrder.findUnique({
    where: { id: orderId },
    include: {
      intakeForm: {
        include: {
          customer: { select: { firstName: true, lastName: true, fullName: true, companyName: true } },
          vehicle: { select: { plate: true } },
        },
      },
    },
  })

  if (!order || !order.estimatedDeliveryAt) {
    return { success: false, error: "Order or delivery date not found" }
  }

  const customerName = order.intakeForm.customer.fullName || order.intakeForm.customer.companyName || [order.intakeForm.customer.firstName, order.intakeForm.customer.lastName].filter(Boolean).join(" ")
  const title = `Teslimat: ${customerName}${order.intakeForm.vehicle?.plate ? ` - ${order.intakeForm.vehicle.plate}` : ""}`

  const event: CalendarEvent = {
    id: order.id,
    title,
    description: `İş Emri: ${order.workOrderNo || order.id}`,
    startAt: order.estimatedDeliveryAt,
    type: "delivery",
    entityId: order.id,
    workshopId,
  }

  const provider = getCalendarProvider()
  const result = await provider.createEvent(event)

  await prisma.calendarSyncLog.create({
    data: {
      workshopId,
      provider: process.env.CALENDAR_PROVIDER || "mock",
      direction: "outbound",
      status: result.success ? "success" : "failed",
      eventType: "delivery",
      entityId: order.id,
      externalEventId: result.externalEventId,
      errorMessage: result.error,
    },
  })

  return result
}

export async function syncMaintenanceReminderToCalendar(reminderId: string, workshopId: string): Promise<{ success: boolean; externalEventId?: string; error?: string }> {
  const reminder = await prisma.maintenanceReminder.findUnique({
    where: { id: reminderId },
    include: {
      customer: { select: { firstName: true, lastName: true, fullName: true } },
      vehicle: { select: { plate: true } },
    },
  })

  if (!reminder || !reminder.dueDate) {
    return { success: false, error: "Reminder or due date not found" }
  }

  const customerName = reminder.customer.fullName || [reminder.customer.firstName, reminder.customer.lastName].filter(Boolean).join(" ")
  const title = `Bakım: ${customerName}${reminder.vehicle?.plate ? ` - ${reminder.vehicle.plate}` : ""} (${reminder.title})`

  const event: CalendarEvent = {
    id: reminder.id,
    title,
    description: reminder.customerNote || reminder.internalNote || undefined,
    startAt: reminder.dueDate,
    type: "maintenance_reminder",
    entityId: reminder.id,
    workshopId,
  }

  const provider = getCalendarProvider()
  const result = await provider.createEvent(event)

  await prisma.calendarSyncLog.create({
    data: {
      workshopId,
      provider: process.env.CALENDAR_PROVIDER || "mock",
      direction: "outbound",
      status: result.success ? "success" : "failed",
      eventType: "maintenance_reminder",
      entityId: reminder.id,
      externalEventId: result.externalEventId,
      errorMessage: result.error,
    },
  })

  return result
}

export async function getCalendarSyncLogs(workshopId: string, limit = 50) {
  return prisma.calendarSyncLog.findMany({
    where: { workshopId },
    orderBy: { syncedAt: "desc" },
    take: limit,
  })
}
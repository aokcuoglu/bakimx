import { prisma } from "@/lib/db"
import { notifyAppointmentReminder, notifyMaintenanceReminder } from "@/lib/communications/triggers"
import { formatReminderType } from "@/lib/reminders/format"

interface SchedulerResult {
  processed: number
  sent: number
  failed: number
  errors: string[]
}

export async function processAppointmentReminders(): Promise<SchedulerResult> {
  const result: SchedulerResult = { processed: 0, sent: 0, failed: 0, errors: [] }

  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const appointments = await prisma.appointment.findMany({
    where: {
      status: { in: ["scheduled", "confirmed"] },
      appointmentAt: { gte: now, lte: in24h },
      reminderStatus: { not: "sent" },
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullName: true,
          companyName: true,
          type: true,
          phone: true,
          email: true,
          smsConsent: true,
          whatsappConsent: true,
          emailConsent: true,
        },
      },
      vehicle: {
        select: { id: true, plate: true, brand: true, model: true },
      },
    },
  })

  for (const appointment of appointments) {
    result.processed++

    const hoursUntil = (appointment.appointmentAt.getTime() - now.getTime()) / (1000 * 60 * 60)

    const hoursBefore = hoursUntil <= 1.5 ? 1 : 24

    const lastRemindedAt = appointment.lastRemindedAt
    if (lastRemindedAt) {
      const hoursSinceLastReminder = (now.getTime() - lastRemindedAt.getTime()) / (1000 * 60 * 60)
      if (hoursBefore === 24 && hoursSinceLastReminder < 12) continue
      if (hoursBefore === 1 && hoursSinceLastReminder < 0.5) continue
    }

    const appointmentDate = appointment.appointmentAt.toLocaleDateString("tr-TR")
    const appointmentTime = appointment.appointmentAt.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    })

    try {
      await notifyAppointmentReminder(
        appointment.workshopId,
        appointment.customerId,
        appointment.vehicle?.plate || null,
        appointmentDate,
        appointmentTime,
        hoursBefore,
        appointment.id,
      )

      await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          reminderStatus: "sent",
          lastRemindedAt: now,
        },
      })

      result.sent++
    } catch (error) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          reminderStatus: "failed",
          lastRemindedAt: now,
        },
      })

      result.failed++
      result.errors.push(`Appointment ${appointment.id}: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`)
    }
  }

  return result
}

export async function processMaintenanceReminders(): Promise<SchedulerResult> {
  const result: SchedulerResult = { processed: 0, sent: 0, failed: 0, errors: [] }

  const now = new Date()

  const reminders = await prisma.maintenanceReminder.findMany({
    where: {
      status: { in: ["upcoming", "due_soon", "overdue"] },
      preferredChannel: { not: "none" },
      reminderStatus: { not: "sent" },
    },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullName: true,
          companyName: true,
          type: true,
          phone: true,
          email: true,
          smsConsent: true,
          whatsappConsent: true,
          emailConsent: true,
        },
      },
      vehicle: {
        select: { id: true, plate: true, brand: true, model: true, mileage: true },
      },
    },
  })

  for (const reminder of reminders) {
    result.processed++

    const lastRemindedAt = reminder.lastRemindedAt
    if (lastRemindedAt) {
      const hoursSinceLastReminder = (now.getTime() - lastRemindedAt.getTime()) / (1000 * 60 * 60)
      if (hoursSinceLastReminder < 24) continue
    }

    let shouldSend = false

    if (reminder.dueDate) {
      const daysUntil = Math.ceil((reminder.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const reminderDaysBefore = reminder.reminderDaysBefore ?? 7

      if (daysUntil <= reminderDaysBefore || daysUntil <= 0) {
        shouldSend = true
      }
    }

    if (reminder.dueMileage != null && reminder.vehicle?.mileage != null) {
      const kmUntil = reminder.dueMileage - reminder.vehicle.mileage
      const reminderKmBefore = reminder.reminderKmBefore ?? 1000

      if (kmUntil <= reminderKmBefore || kmUntil <= 0) {
        shouldSend = true
      }
    }

    if (reminder.status === "overdue") {
      shouldSend = true
    }

    if (!shouldSend) continue

    const dueDateStr = reminder.dueDate
      ? reminder.dueDate.toLocaleDateString("tr-TR")
      : null

    try {
      await notifyMaintenanceReminder(
        reminder.workshopId,
        reminder.customerId,
        reminder.vehicle?.plate || null,
        formatReminderType(reminder.type),
        dueDateStr,
        reminder.id,
      )

      await prisma.maintenanceReminder.update({
        where: { id: reminder.id },
        data: {
          reminderStatus: "sent",
          lastRemindedAt: now,
        },
      })

      result.sent++
    } catch (error) {
      await prisma.maintenanceReminder.update({
        where: { id: reminder.id },
        data: {
          reminderStatus: "failed",
          lastRemindedAt: now,
        },
      })

      result.failed++
      result.errors.push(`Reminder ${reminder.id}: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`)
    }
  }

  return result
}
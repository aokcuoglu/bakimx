import { prisma } from "@/lib/db"
import { processAppointmentReminders, processMaintenanceReminders } from "@/lib/communications/scheduler"
import { notifyWorkOrderCompleted } from "@/lib/communications/triggers"

interface SchedulerJobResult {
  jobType: string
  processed: number
  sent: number
  failed: number
  errors: string[]
}

export async function runAppointmentReminderJob(workshopId: string): Promise<SchedulerJobResult> {
  const result = await processAppointmentReminders()

  await prisma.reminderExecutionLog.create({
    data: {
      workshopId,
      jobType: "appointment_reminder",
      entityType: "appointment",
      status: result.failed > 0 ? "partial" : "success",
      processedCount: result.processed,
      sentCount: result.sent,
      failedCount: result.failed,
      errorMessage: result.errors.length > 0 ? result.errors.join("; ") : null,
    },
  })

  return { jobType: "appointment_reminder", ...result }
}

export async function runMaintenanceReminderJob(workshopId: string): Promise<SchedulerJobResult> {
  const result = await processMaintenanceReminders()

  await prisma.reminderExecutionLog.create({
    data: {
      workshopId,
      jobType: "maintenance_reminder",
      entityType: "reminder",
      status: result.failed > 0 ? "partial" : "success",
      processedCount: result.processed,
      sentCount: result.sent,
      failedCount: result.failed,
      errorMessage: result.errors.length > 0 ? result.errors.join("; ") : null,
    },
  })

  return { jobType: "maintenance_reminder", ...result }
}

export async function runDeliveryReminderJob(workshopId: string): Promise<SchedulerJobResult> {
  const result: SchedulerJobResult = {
    jobType: "delivery_reminder",
    processed: 0,
    sent: 0,
    failed: 0,
    errors: [],
  }

  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const orders = await prisma.serviceOrder.findMany({
    where: {
      workshopId,
      status: "ready_for_delivery",
      estimatedDeliveryAt: { gte: now, lte: in24h },
      paymentStatus: { not: "paid" },
    },
    include: {
      intakeForm: {
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              fullName: true,
              companyName: true,
              phone: true,
              email: true,
              smsConsent: true,
              whatsappConsent: true,
              emailConsent: true,
            },
          },
          vehicle: { select: { id: true, plate: true } },
          shareLinks: { where: { isActive: true }, take: 1 },
        },
      },
    },
  })

  for (const order of orders) {
    result.processed++

    try {
      const vehiclePlate = order.intakeForm.vehicle?.plate || null
      const shareToken = order.intakeForm.shareLinks[0]?.token

      await notifyWorkOrderCompleted(
        workshopId,
        order.intakeForm.customerId,
        vehiclePlate,
        order.workOrderNo || order.id,
        shareToken,
        undefined,
        order.id,
      )

      result.sent++
    } catch (error) {
      result.failed++
      result.errors.push(`Order ${order.id}: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  await prisma.reminderExecutionLog.create({
    data: {
      workshopId,
      jobType: "delivery_reminder",
      entityType: "order",
      status: result.failed > 0 ? "partial" : (result.processed > 0 ? "success" : "success"),
      processedCount: result.processed,
      sentCount: result.sent,
      failedCount: result.failed,
      errorMessage: result.errors.length > 0 ? result.errors.join("; ") : null,
    },
  })

  return result
}

export async function runAllReminderJobs(workshopId: string): Promise<SchedulerJobResult[]> {
  const [appointmentResult, maintenanceResult, deliveryResult] = await Promise.all([
    runAppointmentReminderJob(workshopId),
    runMaintenanceReminderJob(workshopId),
    runDeliveryReminderJob(workshopId),
  ])

  return [appointmentResult, maintenanceResult, deliveryResult]
}

export async function getReminderExecutionLogs(workshopId: string, limit = 50) {
  return prisma.reminderExecutionLog.findMany({
    where: { workshopId },
    orderBy: { executedAt: "desc" },
    take: limit,
  })
}
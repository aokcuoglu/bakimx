import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { ReminderDetail } from "@/components/app/reminder-detail"

export default async function ReminderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, workshop } = await getAppData()

  const reminder = await prisma.maintenanceReminder.findFirst({
    where: { id, workshopId: user.workshopId },
    include: {
      customer: {
        select: { id: true, firstName: true, lastName: true, fullName: true, companyName: true, type: true, phone: true },
      },
      vehicle: {
        select: { id: true, plate: true, brand: true, model: true, mileage: true },
      },
    },
  })

  if (!reminder) notFound()

  const createdAppointment = reminder.createdAppointmentId
    ? await prisma.appointment.findFirst({
        where: { id: reminder.createdAppointmentId, workshopId: user.workshopId },
        select: { id: true, appointmentNo: true, status: true, appointmentAt: true },
      })
    : null

  const safe = {
    id: reminder.id,
    title: reminder.title,
    type: reminder.type,
    status: reminder.status,
    dueDate: reminder.dueDate?.toISOString() ?? null,
    dueMileage: reminder.dueMileage,
    currentMileage: reminder.currentMileage,
    lastServiceDate: reminder.lastServiceDate?.toISOString() ?? null,
    lastServiceMileage: reminder.lastServiceMileage,
    reminderDaysBefore: reminder.reminderDaysBefore,
    reminderKmBefore: reminder.reminderKmBefore,
    preferredChannel: reminder.preferredChannel,
    reminderStatus: reminder.reminderStatus,
    customerNote: reminder.customerNote,
    internalNote: reminder.internalNote,
    completedAt: reminder.completedAt?.toISOString() ?? null,
    completedServiceOrderId: reminder.completedServiceOrderId,
    createdAppointmentId: reminder.createdAppointmentId,
    createdAt: reminder.createdAt.toISOString(),
    updatedAt: reminder.updatedAt.toISOString(),
    customer: reminder.customer,
    vehicle: reminder.vehicle,
    createdAppointment: createdAppointment
      ? {
          id: createdAppointment.id,
          appointmentNo: createdAppointment.appointmentNo ?? `RND-${createdAppointment.id.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase()}`,
          status: createdAppointment.status,
          appointmentAt: createdAppointment.appointmentAt.toISOString(),
        }
      : null,
  }

  return (
    <AppShell workshopName={workshop?.name} pageTitle={reminder.title}>
      <ReminderDetail reminder={safe} />
    </AppShell>
  )
}

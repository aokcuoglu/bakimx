import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { AppointmentDetail } from "@/components/appointments/appointment-detail"
import { formatAppointmentNo } from "@/lib/work-order-number"

export default async function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const paywall = await getFeaturePaywall("appointments")
  if (paywall) return paywall
  const { id } = await params
  const { user, workshop } = await getAppData()

  const appointment = await prisma.appointment.findFirst({
    where: { id, workshopId: user.workshopId },
    include: {
      customer: {
        select: { id: true, firstName: true, lastName: true, fullName: true, companyName: true, type: true, phone: true },
      },
      vehicle: {
        select: { id: true, plate: true, brand: true, model: true },
      },
      convertedServiceOrder: {
        select: { id: true, workOrderNo: true },
      },
    },
  })

  if (!appointment) notFound()

  const safeAppointment = {
    id: appointment.id,
    appointmentNo: formatAppointmentNo(appointment),
    status: appointment.status,
    appointmentAt: appointment.appointmentAt.toISOString(),
    estimatedDurationMinutes: appointment.estimatedDurationMinutes,
    title: appointment.title,
    customerRequest: appointment.customerRequest,
    internalNote: appointment.internalNote,
    reminderStatus: appointment.reminderStatus,
    createdAt: appointment.createdAt.toISOString(),
    customer: appointment.customer,
    vehicle: appointment.vehicle,
    convertedServiceOrder: appointment.convertedServiceOrder,
  }

  return (
    <AppShell
      workshopName={workshop?.name}
      pageTitle={`Randevu ${safeAppointment.appointmentNo}`}
    >
      <AppointmentDetail appointment={safeAppointment} />
    </AppShell>
  )
}

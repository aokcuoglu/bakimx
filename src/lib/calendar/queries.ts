import { prisma } from "@/lib/db"
import { formatReminderType } from "@/lib/reminders/format"

export interface CalendarViewItem {
  id: string
  title: string
  type: "appointment" | "delivery" | "maintenance_reminder"
  startAt: string
  endAt?: string
  status?: string
  customerName?: string
  vehiclePlate?: string
  entityId?: string
  entityType?: string
}

export async function getCalendarEvents(workshopId: string, startDate: Date, endDate: Date): Promise<CalendarViewItem[]> {
  const items: CalendarViewItem[] = []

  const appointments = await prisma.appointment.findMany({
    where: {
      workshopId,
      appointmentAt: { gte: startDate, lte: endDate },
    },
    include: {
      customer: { select: { firstName: true, lastName: true, fullName: true, companyName: true } },
      vehicle: { select: { plate: true } },
    },
    orderBy: { appointmentAt: "asc" },
  })

  for (const a of appointments) {
    const customerName = a.customer.fullName || a.customer.companyName || [a.customer.firstName, a.customer.lastName].filter(Boolean).join(" ")
    items.push({
      id: a.id,
      title: a.title || `Randevu: ${customerName}`,
      type: "appointment",
      startAt: a.appointmentAt.toISOString(),
      endAt: a.estimatedDurationMinutes
        ? new Date(a.appointmentAt.getTime() + a.estimatedDurationMinutes * 60 * 1000).toISOString()
        : undefined,
      status: a.status,
      customerName,
      vehiclePlate: a.vehicle?.plate || undefined,
      entityId: a.id,
      entityType: "appointment",
    })
  }

  const orders = await prisma.serviceOrder.findMany({
    where: {
      workshopId,
      estimatedDeliveryAt: { gte: startDate, lte: endDate },
      status: { in: ["ready_for_delivery", "delivered"] },
    },
    include: {
      intakeForm: {
        include: {
          customer: { select: { firstName: true, lastName: true, fullName: true, companyName: true } },
          vehicle: { select: { plate: true } },
        },
      },
    },
    orderBy: { estimatedDeliveryAt: "asc" },
  })

  for (const o of orders) {
    const customerName = o.intakeForm.customer.fullName || o.intakeForm.customer.companyName || [o.intakeForm.customer.firstName, o.intakeForm.customer.lastName].filter(Boolean).join(" ")
    items.push({
      id: `delivery-${o.id}`,
      title: `Teslimat: ${customerName}`,
      type: "delivery",
      startAt: o.estimatedDeliveryAt!.toISOString(),
      status: o.status,
      customerName,
      vehiclePlate: o.intakeForm.vehicle?.plate || undefined,
      entityId: o.id,
      entityType: "order",
    })
  }

  const reminders = await prisma.maintenanceReminder.findMany({
    where: {
      workshopId,
      dueDate: { gte: startDate, lte: endDate },
      status: { not: "cancelled" },
    },
    include: {
      customer: { select: { firstName: true, lastName: true, fullName: true } },
      vehicle: { select: { plate: true } },
    },
    orderBy: { dueDate: "asc" },
  })

  for (const r of reminders) {
    const customerName = r.customer.fullName || [r.customer.firstName, r.customer.lastName].filter(Boolean).join(" ")
    items.push({
      id: r.id,
      title: `${formatReminderType(r.type)}: ${customerName}`,
      type: "maintenance_reminder",
      startAt: r.dueDate!.toISOString(),
      status: r.status,
      customerName,
      vehiclePlate: r.vehicle?.plate || undefined,
      entityId: r.id,
      entityType: "reminder",
    })
  }

  items.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  return items
}
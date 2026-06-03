import { prisma } from "@/lib/db"

export type ReminderRow = {
  id: string
  title: string
  type: string
  status: string
  dueDate: string | null
  dueMileage: number | null
  currentMileage: number | null
  preferredChannel: string
  reminderStatus: string
  completedAt: string | null
  completedServiceOrderId: string | null
  createdAppointmentId: string | null
  customerNote: string | null
  internalNote: string | null
  lastServiceDate: string | null
  lastServiceMileage: number | null
  reminderDaysBefore: number | null
  reminderKmBefore: number | null
  createdAt: string
  customer: {
    id: string
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    type: string
    phone: string
  }
  vehicle: {
    id: string
    plate: string
    brand: string
    model: string
    mileage: number | null
  }
}

type ReminderRecord = {
  id: string
  title: string
  type: string
  status: string
  dueDate: Date | null
  dueMileage: number | null
  currentMileage: number | null
  preferredChannel: string
  reminderStatus: string
  completedAt: Date | null
  completedServiceOrderId: string | null
  createdAppointmentId: string | null
  customerNote: string | null
  internalNote: string | null
  lastServiceDate: Date | null
  lastServiceMileage: number | null
  reminderDaysBefore: number | null
  reminderKmBefore: number | null
  createdAt: Date
  customer: ReminderRow["customer"]
  vehicle: ReminderRow["vehicle"]
}

function serializeDates(r: ReminderRecord): ReminderRow {
  return {
    ...r,
    dueDate: r.dueDate?.toISOString() ?? null,
    lastServiceDate: r.lastServiceDate?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt?.toISOString() ?? null,
  }
}

export async function getRemindersList(workshopId: string, filters?: {
  status?: string
  type?: string
  search?: string
  dateFilter?: string
}): Promise<ReminderRow[]> {
  const where: Record<string, unknown> = { workshopId }

  if (filters?.status) {
    where.status = filters.status
  }
  if (filters?.type) {
    where.type = filters.type
  }
  if (filters?.dateFilter) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    switch (filters.dateFilter) {
      case "today": {
        const tomorrow = new Date(today.getTime() + 86400000)
        where.dueDate = { gte: today, lt: tomorrow }
        break
      }
      case "week": {
        const weekEnd = new Date(today.getTime() + 7 * 86400000)
        where.dueDate = { gte: today, lt: weekEnd }
        break
      }
      case "month": {
        const monthEnd = new Date(today.getTime() + 30 * 86400000)
        where.dueDate = { gte: today, lt: monthEnd }
        break
      }
      case "overdue": {
        where.dueDate = { lt: today }
        where.status = { notIn: ["completed", "cancelled"] }
        break
      }
    }
  }

  if (filters?.search) {
    const q = filters.search
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { customer: { phone: { contains: q, mode: "insensitive" } } },
      { customer: { firstName: { contains: q, mode: "insensitive" } } },
      { customer: { lastName: { contains: q, mode: "insensitive" } } },
      { customer: { fullName: { contains: q, mode: "insensitive" } } },
      { customer: { companyName: { contains: q, mode: "insensitive" } } },
      { vehicle: { plate: { contains: q, mode: "insensitive" } } },
      { vehicle: { brand: { contains: q, mode: "insensitive" } } },
      { vehicle: { model: { contains: q, mode: "insensitive" } } },
    ]
  }

  const reminders = await prisma.maintenanceReminder.findMany({
    where,
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
        },
      },
      vehicle: {
        select: {
          id: true,
          plate: true,
          brand: true,
          model: true,
          mileage: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return reminders.map(serializeDates)
}

export async function getReminderById(workshopId: string, id: string): Promise<ReminderRow | null> {
  const r = await prisma.maintenanceReminder.findFirst({
    where: { id, workshopId },
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
        },
      },
      vehicle: {
        select: {
          id: true,
          plate: true,
          brand: true,
          model: true,
          mileage: true,
        },
      },
    },
  })
  return r ? serializeDates(r) : null
}

export async function getDueSoonReminders(workshopId: string, limit = 10): Promise<ReminderRow[]> {
  const reminders = await prisma.maintenanceReminder.findMany({
    where: {
      workshopId,
      status: { notIn: ["completed", "cancelled", "overdue", "postponed"] },
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
        },
      },
      vehicle: {
        select: {
          id: true,
          plate: true,
          brand: true,
          model: true,
          mileage: true,
        },
      },
    },
    orderBy: { dueDate: "asc" },
    take: limit,
  })

  return reminders.map(serializeDates)
}

export async function getOverdueReminders(workshopId: string, limit = 10): Promise<ReminderRow[]> {
  const reminders = await prisma.maintenanceReminder.findMany({
    where: {
      workshopId,
      status: "overdue",
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
        },
      },
      vehicle: {
        select: {
          id: true,
          plate: true,
          brand: true,
          model: true,
          mileage: true,
        },
      },
    },
    orderBy: { dueDate: "asc" },
    take: limit,
  })

  return reminders.map(serializeDates)
}

export async function getVehicleReminders(workshopId: string, vehicleId: string, limit = 20): Promise<ReminderRow[]> {
  const reminders = await prisma.maintenanceReminder.findMany({
    where: { workshopId, vehicleId },
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
        },
      },
      vehicle: {
        select: {
          id: true,
          plate: true,
          brand: true,
          model: true,
          mileage: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  return reminders.map(serializeDates)
}

export async function getCustomerReminders(workshopId: string, customerId: string, limit = 20): Promise<ReminderRow[]> {
  const reminders = await prisma.maintenanceReminder.findMany({
    where: { workshopId, customerId },
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
        },
      },
      vehicle: {
        select: {
          id: true,
          plate: true,
          brand: true,
          model: true,
          mileage: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  return reminders.map(serializeDates)
}

import { prisma } from "@/lib/db"

type OStat = import("@prisma/client").OrderStatus

const NOT_DELIVERED_CANCELLED: OStat[] = ["delivered", "cancelled"]

export interface TechnicianDashboardStats {
  assignedToMe: number
  inProgress: number
  waiting: number
  completed: number
  todayDelivery: number
}

export async function getTechnicianDashboardStats(
  workshopId: string,
  technicianId: string
): Promise<TechnicianDashboardStats> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 86400000)

  const [
    assignedToMe,
    inProgress,
    waiting,
    completed,
    todayDelivery,
  ] = await Promise.all([
    prisma.serviceOrder.count({
      where: {
        workshopId,
        assignedTechnicianId: technicianId,
        status: { notIn: NOT_DELIVERED_CANCELLED },
      },
    }),
    prisma.serviceOrder.count({
      where: {
        workshopId,
        assignedTechnicianId: technicianId,
        status: "in_progress",
      },
    }),
    prisma.serviceOrder.count({
      where: {
        workshopId,
        assignedTechnicianId: technicianId,
        status: { in: ["approved", "waiting_parts"] },
      },
    }),
    prisma.serviceOrder.count({
      where: {
        workshopId,
        assignedTechnicianId: technicianId,
        status: "delivered",
        completedAt: { gte: today },
      },
    }),
    prisma.serviceOrder.count({
      where: {
        workshopId,
        assignedTechnicianId: technicianId,
        estimatedDeliveryAt: { gte: today, lt: tomorrow },
        status: { notIn: NOT_DELIVERED_CANCELLED },
      },
    }),
  ])

  return { assignedToMe, inProgress, waiting, completed, todayDelivery }
}

export interface TechnicianOrderRow {
  id: string
  workOrderNo: string
  status: string
  customerName: string
  customerPhone: string
  plate: string
  brand: string
  model: string
  customerComplaint: string
  estimatedDeliveryAt: string | null
  assignedAt: string | null
  completedAt: string | null
  createdAt: string
  technicianName: string | null
  checklistProgress: { completed: number; total: number }
  hasActiveLabor: boolean
}

export async function getTechnicianOrders(
  workshopId: string,
  technicianId: string,
  status?: string
): Promise<TechnicianOrderRow[]> {
  const where: import("@prisma/client").Prisma.ServiceOrderWhereInput = {
    workshopId,
    assignedTechnicianId: technicianId,
    ...(status ? { status: status as OStat } : { status: { notIn: NOT_DELIVERED_CANCELLED } }),
  }

  const orders = await prisma.serviceOrder.findMany({
    where,
    include: {
      intakeForm: {
        include: {
          customer: { select: { firstName: true, lastName: true, fullName: true, companyName: true, type: true, phone: true } },
          vehicle: { select: { plate: true, brand: true, model: true } },
        },
      },
      assignedTechnician: { select: { fullName: true } },
      checklistItems: { select: { isCompleted: true } },
      laborSessions: { select: { endTime: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return orders.map((o) => {
    const cust = o.intakeForm.customer
    const customerName =
      cust.type === "corporate"
        ? cust.companyName || "Kurumsal"
        : cust.fullName || [cust.firstName, cust.lastName].filter(Boolean).join(" ") || "Müşteri"

    const checklistTotal = o.checklistItems.length
    const checklistCompleted = o.checklistItems.filter((c) => c.isCompleted).length
    const hasActiveLabor = o.laborSessions.some((l) => !l.endTime)

    return {
      id: o.id,
      workOrderNo: o.workOrderNo || `BX-${o.id.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase()}`,
      status: o.status,
      customerName,
      customerPhone: cust.phone,
      plate: o.intakeForm.vehicle.plate,
      brand: o.intakeForm.vehicle.brand,
      model: o.intakeForm.vehicle.model,
      customerComplaint: o.intakeForm.customerComplaint,
      estimatedDeliveryAt: o.estimatedDeliveryAt?.toISOString() ?? null,
      assignedAt: o.assignedAt?.toISOString() ?? null,
      completedAt: o.completedAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
      technicianName: o.assignedTechnician?.fullName || o.technicianName || null,
      checklistProgress: { completed: checklistCompleted, total: checklistTotal },
      hasActiveLabor,
    }
  })
}

export async function getTechnicianOrderDetail(
  workshopId: string,
  orderId: string,
  technicianId: string
) {
  const order = await prisma.serviceOrder.findFirst({
    where: { id: orderId, workshopId, assignedTechnicianId: technicianId },
    include: {
      intakeForm: {
        include: {
          customer: true,
          vehicle: true,
          damageMarks: { orderBy: { createdAt: "asc" } },
          photos: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true, type: true, label: true, required: true,
              fileUrl: true, fileName: true, mimeType: true, sizeBytes: true,
              phase: true, serviceOrderId: true, note: true, createdAt: true,
            },
          },
        },
      },
      items: { orderBy: { createdAt: "asc" } },
      assignedTechnician: { select: { id: true, fullName: true, role: true } },
      checklistItems: { orderBy: { sortOrder: "asc" } },
      internalNotes: { orderBy: { createdAt: "desc" } },
      partsRequests: { orderBy: { createdAt: "desc" } },
      laborSessions: { orderBy: { startTime: "desc" } },
    },
  })

  return order
}

export async function getTechnicians(workshopId: string) {
  return prisma.technician.findMany({
    where: { workshopId, isActive: true },
    orderBy: { fullName: "asc" },
  })
}

export async function getManagerTechnicianOverview(workshopId: string) {
  const technicians = await prisma.technician.findMany({
    where: { workshopId, isActive: true },
    include: {
      assignedOrders: {
        where: { status: { notIn: NOT_DELIVERED_CANCELLED } },
        select: {
          id: true,
          status: true,
          estimatedDeliveryAt: true,
          createdAt: true,
        },
      },
    },
    orderBy: { fullName: "asc" },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return technicians.map((t) => ({
    id: t.id,
    fullName: t.fullName,
    phone: t.phone,
    role: t.role,
    activeJobs: t.assignedOrders.length,
    inProgressJobs: t.assignedOrders.filter((o) => o.status === "in_progress").length,
    delayedJobs: t.assignedOrders.filter(
      (o) => o.estimatedDeliveryAt && o.estimatedDeliveryAt < today && o.status !== "delivered" && o.status !== "cancelled"
    ).length,
    completedToday: 0,
  }))
}
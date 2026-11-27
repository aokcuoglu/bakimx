import { prisma } from "@/lib/db"
import { VISIBLE_PHOTO } from "@/lib/intake/photo-visibility"
import { ACTIVE_CHECKLIST_ITEM } from "@/lib/technician/checklist-visibility"
import {
  technicianOrderDetailWhere,
  technicianOrderListWhere,
} from "@/lib/technician/order-visibility"
import { UNASSIGNED_IN_SERVICE_WHERE } from "@/lib/orders/unassigned-in-service"
import { completedTodayWhere } from "@/lib/technician/kiosk-home"

type OStat = import("@prisma/client").OrderStatus

const NOT_DELIVERED_CANCELLED: OStat[] = ["delivered", "cancelled"]

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
  assignedTechnicianId: string | null
  technicianName: string | null
  checklistProgress: { completed: number; total: number }
  hasActiveLabor: boolean
}

const ORDER_ROW_INCLUDE = {
  intakeForm: {
    include: {
      customer: { select: { firstName: true, lastName: true, fullName: true, companyName: true, type: true, phone: true } },
      vehicle: { select: { plate: true, brand: true, model: true } },
    },
  },
  assignedTechnician: { select: { fullName: true } },
  checklistItems: { where: ACTIVE_CHECKLIST_ITEM, select: { isCompleted: true } },
  laborSessions: { select: { endTime: true } },
} satisfies import("@prisma/client").Prisma.ServiceOrderInclude

type OrderRowSource = import("@prisma/client").Prisma.ServiceOrderGetPayload<{
  include: typeof ORDER_ROW_INCLUDE
}>

function toTechnicianOrderRow(o: OrderRowSource): TechnicianOrderRow {
  const cust = o.intakeForm.customer
  const customerName =
    cust.type === "corporate"
      ? cust.companyName || "Kurumsal"
      : cust.fullName || [cust.firstName, cust.lastName].filter(Boolean).join(" ") || "Müşteri"

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
    assignedTechnicianId: o.assignedTechnicianId,
    technicianName: o.assignedTechnician?.fullName || o.technicianName || null,
    checklistProgress: {
      completed: o.checklistItems.filter((c) => c.isCompleted).length,
      total: o.checklistItems.length,
    },
    hasActiveLabor: o.laborSessions.some((l) => !l.endTime),
  }
}

export async function getTechnicianOrders(
  workshopId: string,
  technicianId?: string,
  status?: string
): Promise<TechnicianOrderRow[]> {
  const where: import("@prisma/client").Prisma.ServiceOrderWhereInput =
    technicianOrderListWhere(workshopId, technicianId, status)

  const orders = await prisma.serviceOrder.findMany({
    where,
    include: ORDER_ROW_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return orders.map(toTechnicianOrderRow)
}

/** Teknisyen ana ekranındaki "Bugün biten" grubu (İstanbul gününe göre). */
export async function getCompletedTodayTechnicianOrders(
  workshopId: string,
  technicianId?: string
): Promise<TechnicianOrderRow[]> {
  const orders = await prisma.serviceOrder.findMany({
    where: completedTodayWhere(workshopId, new Date(), technicianId),
    include: ORDER_ROW_INCLUDE,
    orderBy: { completedAt: "desc" },
  })
  return orders.map(toTechnicianOrderRow)
}

export async function getTechnicianOrderDetail(
  workshopId: string,
  orderId: string
) {
  const order = await prisma.serviceOrder.findFirst({
    where: technicianOrderDetailWhere(workshopId, orderId),
    include: {
      intakeForm: {
        include: {
          customer: true,
          vehicle: true,
          damageMarks: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
          photos: {
            where: VISIBLE_PHOTO,
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
      checklistItems: { where: ACTIVE_CHECKLIST_ITEM, orderBy: { sortOrder: "asc" } },
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

export interface AssignableTechnician {
  id: string
  fullName: string
  role: string
  /** Teslim/iptal dışındaki, o an üzerinde olan iş sayısı — atama sırasında yük göstergesi. */
  activeJobs: number
}

/**
 * Atama arayüzünün beslendiği liste: aktif ustalar + üzerlerindeki iş yükü.
 * `getTechnicians`ten ayrı tutuldu çünkü burada sayım maliyeti var ve
 * dönen şekil UI'a özgü (client'a serialize edilebilir sade alanlar).
 */
export async function getAssignableTechnicians(workshopId: string): Promise<AssignableTechnician[]> {
  const technicians = await prisma.technician.findMany({
    where: { workshopId, isActive: true },
    select: {
      id: true,
      fullName: true,
      role: true,
      _count: {
        select: {
          assignedOrders: { where: { status: { notIn: NOT_DELIVERED_CANCELLED } } },
        },
      },
    },
    orderBy: { fullName: "asc" },
  })

  return technicians.map((t) => ({
    id: t.id,
    fullName: t.fullName,
    role: t.role,
    activeJobs: t._count.assignedOrders,
  }))
}

/**
 * Ustası olmayan serviste iş emri sayısı — dağıtım görünürlüğü için. Genel
 * Bakış uyarısının bağlantısıyla aynı tanımı kullanır (#833).
 */
export async function getUnassignedOrderCount(workshopId: string): Promise<number> {
  return prisma.serviceOrder.count({
    where: { workshopId, ...UNASSIGNED_IN_SERVICE_WHERE },
  })
}

import { prisma } from "@/lib/db"
import { applyTaxBps, addKurus } from "@/lib/money"

type OStat = import("@prisma/client").OrderStatus
type IStat = import("@prisma/client").IntakeStatus
type VPT = import("@prisma/client").VehiclePhotoType

const NOT_DELIVERED_CANCELLED: OStat[] = ["delivered", "cancelled"]
const NOT_DELIVERED_CANCELLED_INTAKE: IStat[] = ["delivered", "cancelled"]
const REQUIRED_PHOTO_TYPES: VPT[] = ["front", "rear", "left_side", "right_side", "dashboard_mileage"]

function todayStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function monthStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
}

export interface DashboardStats {
  activeOrders: number
  todayDeliveries: number
  waitingApprovals: number
  missingPhotoIntakes: number
  overdueDeliveries: number
  lastWeekOrders: number
  todayCollected: number
  openReceivable: number
  partialPayments: number
}

export async function getDashboardStats(workshopId: string): Promise<DashboardStats> {
  const today = todayStart()
  const tomorrow = new Date(today.getTime() + 86400000)
  const sevenDaysAgo = daysAgo(7)

  const [
    activeOrders,
    todayDeliveries,
    waitingApprovals,
    overdueDeliveries,
    lastWeekOrders,
    allActiveIntakes,
    todayCollections,
    activeReceivableOrders,
  ] = await Promise.all([
    prisma.serviceOrder.count({
      where: { workshopId, status: { notIn: NOT_DELIVERED_CANCELLED } },
    }),
    prisma.serviceOrder.count({
      where: {
        workshopId,
        estimatedDeliveryAt: { gte: today, lt: tomorrow },
        status: { notIn: NOT_DELIVERED_CANCELLED },
      },
    }),
    prisma.serviceOrder.count({
      where: { workshopId, status: "waiting_approval" },
    }),
    prisma.serviceOrder.count({
      where: {
        workshopId,
        estimatedDeliveryAt: { lt: today },
        status: { notIn: NOT_DELIVERED_CANCELLED },
      },
    }),
    prisma.serviceOrder.count({
      where: { workshopId, createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.vehicleIntakeForm.findMany({
      where: { workshopId, status: { notIn: NOT_DELIVERED_CANCELLED_INTAKE } },
      select: { id: true },
    }),
    prisma.collectionPayment.aggregate({
      where: { workshopId, status: "completed", paymentDate: { gte: today } },
      _sum: { amount: true },
    }),
    prisma.serviceOrder.findMany({
      where: {
        workshopId,
        status: { notIn: ["cancelled"] },
        paymentStatus: { in: ["unpaid", "partial"] },
      },
      include: {
        items: { select: { totalPrice: true, unitPrice: true, quantity: true, type: true } },
      },
    }),
  ])

  const intakeIds = allActiveIntakes.map((i) => i.id)

  let missingPhotoIntakes = 0
  if (intakeIds.length > 0) {
    const photos = await prisma.vehiclePhoto.findMany({
      where: {
        workshopId,
        intakeFormId: { in: intakeIds },
        type: { in: REQUIRED_PHOTO_TYPES },
      },
      select: { intakeFormId: true, type: true },
    })

    const photoMap = new Map<string, Set<string>>()
    for (const p of photos) {
      if (!photoMap.has(p.intakeFormId)) photoMap.set(p.intakeFormId, new Set())
      photoMap.get(p.intakeFormId)!.add(p.type)
    }

    for (const intakeId of intakeIds) {
      const types = photoMap.get(intakeId)
      if (!types || types.size < REQUIRED_PHOTO_TYPES.length) {
        missingPhotoIntakes++
      }
    }
  }

  const todayCollected = todayCollections._sum.amount || 0

  let openReceivable = 0
  let partialPayments = 0
  for (const order of activeReceivableOrders) {
    const t = order.items.reduce((sum, item) => {
      if (item.totalPrice != null && item.totalPrice > 0) return sum + item.totalPrice
      if (item.unitPrice != null && item.unitPrice > 0) return sum + item.unitPrice * item.quantity
      return sum
    }, 0)
    const discount = order.discountAmount ?? 0
    const taxRate = order.taxRate ?? 0
    const subtotal = Math.max(0, t - discount)
    const tax = applyTaxBps(subtotal, taxRate) // taxRate is bps
    const grandTotal = addKurus(subtotal, tax)
    const paid = order.paidAmount || 0
    const remaining = Math.max(0, grandTotal - paid)
    if (remaining > 0) {
      openReceivable += remaining
      if (order.paymentStatus === "partial") partialPayments++
    }
  }

  return {
    activeOrders,
    todayDeliveries,
    waitingApprovals,
    missingPhotoIntakes,
    overdueDeliveries,
    lastWeekOrders,
    todayCollected,
    openReceivable,
    partialPayments,
  }
}

export interface ActiveWorkOrderRow {
  id: string
  workOrderNo: string
  status: string
  approvalStatus: string | null
  total: number
  hasPrice: boolean
  estimatedDeliveryAt: string | null
  createdAt: string
  plate: string
  brand: string
  model: string
  customerName: string
  customerPhone: string
  intakeFormId: string
  hasPublicLink: boolean
  photoCompletion: { present: number; required: number }
}

export async function getActiveWorkOrders(
  workshopId: string,
  limit = 10
): Promise<ActiveWorkOrderRow[]> {
  const orders = await prisma.serviceOrder.findMany({
    where: { workshopId, status: { notIn: NOT_DELIVERED_CANCELLED } },
    include: {
      intakeForm: {
        include: {
          customer: { select: { firstName: true, lastName: true, fullName: true, companyName: true, type: true, phone: true } },
          vehicle: { select: { plate: true, brand: true, model: true } },
          photos: {
            where: { type: { in: REQUIRED_PHOTO_TYPES } },
            select: { type: true },
          },
        },
      },
      items: { select: { type: true, quantity: true, unitPrice: true, totalPrice: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return orders.map((o) => {
    const intake = o.intakeForm
    const cust = intake.customer
    const customerName =
      cust.type === "corporate"
        ? cust.companyName || "Kurumsal"
        : cust.fullName || [cust.firstName, cust.lastName].filter(Boolean).join(" ") || "Müşteri"

    const photoTypesPresent = new Set(intake.photos.map((p) => p.type))
    const present = REQUIRED_PHOTO_TYPES.filter((t) => photoTypesPresent.has(t)).length

    const totals = o.items.reduce(
      (acc, item) => {
        const lineTotal =
          item.totalPrice != null && item.totalPrice > 0
            ? item.totalPrice
            : item.unitPrice != null && item.unitPrice > 0
              ? item.unitPrice * item.quantity
              : 0
        return acc + lineTotal
      },
      0
    )

    return {
      id: o.id,
      workOrderNo: o.workOrderNo || `BX-${o.id.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase()}`,
      status: o.status,
      approvalStatus: intake.status === ("waiting_approval" as unknown as IStat) ? intake.status : null,
      total: totals,
      hasPrice: totals > 0,
      estimatedDeliveryAt: o.estimatedDeliveryAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
      plate: intake.vehicle.plate,
      brand: intake.vehicle.brand,
      model: intake.vehicle.model,
      customerName,
      customerPhone: cust.phone,
      intakeFormId: intake.id,
      hasPublicLink: false,
      photoCompletion: { present, required: REQUIRED_PHOTO_TYPES.length },
    }
  })
}

export interface TodayDelivery {
  id: string
  workOrderNo: string
  plate: string
  customerName: string
  estimatedDeliveryAt: string | null
  status: string
}

export async function getTodayDeliveries(workshopId: string): Promise<TodayDelivery[]> {
  const today = todayStart()
  const tomorrow = new Date(today.getTime() + 86400000)

  const orders = await prisma.serviceOrder.findMany({
    where: {
      workshopId,
      estimatedDeliveryAt: { gte: today, lt: tomorrow },
      status: { notIn: NOT_DELIVERED_CANCELLED },
    },
    include: {
      intakeForm: {
        include: {
          customer: { select: { firstName: true, lastName: true, fullName: true, companyName: true, type: true } },
          vehicle: { select: { plate: true } },
        },
      },
    },
    orderBy: { estimatedDeliveryAt: "asc" },
  })

  return orders.map((o) => ({
    id: o.id,
    workOrderNo: o.workOrderNo || `BX-${o.id.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase()}`,
    plate: o.intakeForm.vehicle.plate,
    customerName: o.intakeForm.customer.type === "corporate"
      ? o.intakeForm.customer.companyName || "Kurumsal"
      : o.intakeForm.customer.fullName ||
        [o.intakeForm.customer.firstName, o.intakeForm.customer.lastName].filter(Boolean).join(" ") ||
        "Müşteri",
    estimatedDeliveryAt: o.estimatedDeliveryAt?.toISOString() ?? null,
    status: o.status,
  }))
}

export interface WaitingApprovalItem {
  id: string
  workOrderNo: string
  plate: string
  customerName: string
  createdAt: string
  intakeFormId: string
}

export async function getWaitingApprovals(workshopId: string): Promise<WaitingApprovalItem[]> {
  const orders = await prisma.serviceOrder.findMany({
    where: { workshopId, status: "waiting_approval" },
    include: {
      intakeForm: {
        include: {
          customer: { select: { firstName: true, lastName: true, fullName: true, companyName: true, type: true } },
          vehicle: { select: { plate: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  return orders.map((o) => ({
    id: o.id,
    workOrderNo: o.workOrderNo || `BX-${o.id.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase()}`,
    plate: o.intakeForm.vehicle.plate,
    customerName: o.intakeForm.customer.type === "corporate"
      ? o.intakeForm.customer.companyName || "Kurumsal"
      : o.intakeForm.customer.fullName ||
        [o.intakeForm.customer.firstName, o.intakeForm.customer.lastName].filter(Boolean).join(" ") ||
        "Müşteri",
    createdAt: o.createdAt.toISOString(),
    intakeFormId: o.intakeForm.id,
  }))
}

export interface MissingPhotoItem {
  orderId: string
  workOrderNo: string
  plate: string
  customerName: string
  missingCount: number
  intakeFormId: string
}

export async function getMissingPhotoItems(workshopId: string): Promise<MissingPhotoItem[]> {
  const activeOrders = await prisma.serviceOrder.findMany({
    where: { workshopId, status: { notIn: NOT_DELIVERED_CANCELLED } },
    include: {
      intakeForm: {
        include: {
          customer: { select: { firstName: true, lastName: true, fullName: true, companyName: true, type: true } },
          vehicle: { select: { plate: true } },
          photos: {
            where: { type: { in: REQUIRED_PHOTO_TYPES } },
            select: { type: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  const results: MissingPhotoItem[] = []

  for (const o of activeOrders) {
    const intake = o.intakeForm
    const photosByType = new Set(intake.photos.map((p) => p.type))
    const missing = REQUIRED_PHOTO_TYPES.filter((t) => !photosByType.has(t))

    if (missing.length > 0) {
      const cust = intake.customer
      const customerName =
        cust.type === "corporate"
          ? cust.companyName || "Kurumsal"
          : cust.fullName || [cust.firstName, cust.lastName].filter(Boolean).join(" ") || "Müşteri"

      results.push({
        orderId: o.id,
        workOrderNo: o.workOrderNo || `BX-${o.id.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase()}`,
        plate: intake.vehicle.plate,
        customerName,
        missingCount: missing.length,
        intakeFormId: intake.id,
      })
    }
  }

  return results
}

export interface RecentCustomer {
  id: string
  name: string
  phone: string
  type: string
  createdAt: string
}

export async function getRecentCustomers(
  workshopId: string,
  limit = 6
): Promise<RecentCustomer[]> {
  const customers = await prisma.customer.findMany({
    where: { workshopId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      firstName: true,
      lastName: true,
      fullName: true,
      companyName: true,
      phone: true,
      createdAt: true,
    },
  })

  return customers.map((c) => ({
    id: c.id,
    name:
      c.type === "corporate"
        ? c.companyName || "Kurumsal"
        : c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || "Müşteri",
    phone: c.phone,
    type: c.type,
    createdAt: c.createdAt.toISOString(),
  }))
}

export interface WeeklyOperation {
  date: string
  label: string
  ordersCreated: number
}

export async function getWeeklyOperations(workshopId: string): Promise<WeeklyOperation[]> {
  const sevenDaysAgo = daysAgo(6)

  const orders = await prisma.serviceOrder.findMany({
    where: { workshopId, createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  const dayNames = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"]

  const dayMap = new Map<string, number>()
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo.getTime() + i * 86400000)
    const key = d.toISOString().slice(0, 10)
    dayMap.set(key, 0)
  }

  for (const o of orders) {
    const key = o.createdAt.toISOString().slice(0, 10)
    if (dayMap.has(key)) {
      dayMap.set(key, (dayMap.get(key) || 0) + 1)
    }
  }

  const result: WeeklyOperation[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo.getTime() + i * 86400000)
    const key = d.toISOString().slice(0, 10)
    const count = dayMap.get(key) || 0
    const dayOfWeek = d.getDay()
    result.push({
      date: key,
      label: dayNames[dayOfWeek],
      ordersCreated: count,
    })
  }

  return result
}

export interface StatusDistribution {
  status: string
  label: string
  count: number
  color: string
}

export interface TodayAppointmentRow {
  id: string
  appointmentNo: string
  appointmentAt: string
  status: string
  customerName: string
  customerPhone: string
  plate: string | null
  brand: string | null
  model: string | null
}

export async function getTodayAppointmentRows(workshopId: string): Promise<TodayAppointmentRow[]> {
  const today = todayStart()
  const tomorrow = new Date(today.getTime() + 86400000)

  const appointments = await prisma.appointment.findMany({
    where: {
      workshopId,
      appointmentAt: { gte: today, lt: tomorrow },
      status: { notIn: ["cancelled", "completed"] },
    },
    include: {
      customer: { select: { firstName: true, lastName: true, fullName: true, companyName: true, type: true, phone: true } },
      vehicle: { select: { plate: true, brand: true, model: true } },
    },
    orderBy: { appointmentAt: "asc" },
    take: 10,
  })

  return appointments.map((a) => ({
    id: a.id,
    appointmentNo: a.appointmentNo || `RND-${a.id.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase()}`,
    appointmentAt: a.appointmentAt.toISOString(),
    status: a.status,
    customerName: a.customer.type === "corporate"
      ? a.customer.companyName || "Kurumsal"
      : a.customer.fullName || [a.customer.firstName, a.customer.lastName].filter(Boolean).join(" ") || "Müşteri",
    customerPhone: a.customer.phone,
    plate: a.vehicle?.plate || null,
    brand: a.vehicle?.brand || null,
    model: a.vehicle?.model || null,
  }))
}

export async function getWorkStatusDistribution(workshopId: string): Promise<StatusDistribution[]> {
  const startOfMonth = monthStart()

  const orders = await prisma.serviceOrder.findMany({
    where: { workshopId, createdAt: { gte: startOfMonth } },
    select: { status: true },
  })

  const statusLabels: Record<string, { label: string; color: string }> = {
    draft: { label: "Taslak", color: "#64748B" },
    waiting_approval: { label: "Onay Bekliyor", color: "#F59E0B" },
    approved: { label: "Onaylandı", color: "#10B981" },
    in_progress: { label: "Devam Ediyor", color: "#3B82F6" },
    waiting_parts: { label: "Parça Bekliyor", color: "#F97316" },
    ready_for_delivery: { label: "Teslime Hazır", color: "#8B5CF6" },
    delivered: { label: "Teslim Edildi", color: "#059669" },
    cancelled: { label: "İptal", color: "#EF4444" },
  }

  const countByStatus = new Map<string, number>()
  for (const status of Object.keys(statusLabels)) {
    countByStatus.set(status, 0)
  }
  for (const o of orders) {
    countByStatus.set(o.status, (countByStatus.get(o.status) || 0) + 1)
  }

  return Object.entries(statusLabels)
    .map(([status, info]) => ({
      status,
      label: info.label,
      count: countByStatus.get(status) || 0,
      color: info.color,
    }))
    .filter((s) => s.count > 0)
}

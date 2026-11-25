import { ORDER_TOTALS_ITEM_SELECT } from "@/lib/totals"
import { prisma } from "@/lib/db"
import { quantityToNumber } from "@/lib/orders/quantity"
import { applyTaxBps, addKurus } from "@/lib/money"
import { VISIBLE_PHOTO } from "@/lib/intake/photo-visibility"
import { IN_SERVICE_ORDER_STATUSES } from "@/lib/orders/status-filter"
import { DELIVERY_OVERDUE, DELIVERY_TODAY, resolveDeliveryFilter } from "@/lib/orders/delivery-filter"
import { istanbulDayBounds, istanbulDayStart } from "@/lib/istanbul-time"

type OStat = import("@prisma/client").OrderStatus
type IStat = import("@prisma/client").IntakeStatus
type VPT = import("@prisma/client").VehiclePhotoType

const NOT_DELIVERED_CANCELLED_INTAKE: IStat[] = ["delivered", "cancelled"]
const REQUIRED_PHOTO_TYPES: VPT[] = ["front", "rear", "left_side", "right_side", "dashboard_mileage"]

const CUSTOMER_NAME_SELECT = {
  type: true,
  companyName: true,
  fullName: true,
  firstName: true,
  lastName: true,
} as const

function customerDisplayName(c: {
  type: string
  companyName: string | null
  fullName: string | null
  firstName: string | null
  lastName: string | null
}): string {
  return c.type === "corporate"
    ? c.companyName || "Kurumsal"
    : c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || "Müşteri"
}



export interface DashboardStats {
  activeOrders: number
  todayDeliveries: number
  waitingApprovals: number
  missingPhotoIntakes: number
  overdueDeliveries: number
  todayCollected: number
  openReceivable: number
  partialPayments: number
}

export async function getDashboardStats(
  workshopId: string,
  access: { quotes: boolean; photoChecklist: boolean; cashbox: boolean } = {
    quotes: true,
    photoChecklist: true,
    cashbox: true,
  }
): Promise<DashboardStats> {
  // Bugün = Türkiye günü, sunucunun saat diliminden bağımsız (#874).
  const today = istanbulDayStart()
  // KPI kartları tıklanınca /orders'ı aynı filtreyle açar; sayım ile liste
  // aynı tanımdan beslensin diye where parçaları liste filtresinden alınır.
  const todayDeliveryWhere = resolveDeliveryFilter(DELIVERY_TODAY).where
  const overdueDeliveryWhere = resolveDeliveryFilter(DELIVERY_OVERDUE).where

  const [
    activeOrders,
    todayDeliveries,
    waitingApprovals,
    overdueDeliveries,
    allActiveIntakes,
    todayCollections,
    activeReceivableOrders,
  ] = await Promise.all([
    prisma.serviceOrder.count({
      where: { workshopId, status: { in: IN_SERVICE_ORDER_STATUSES } },
    }),
    prisma.serviceOrder.count({
      where: { workshopId, ...todayDeliveryWhere },
    }),
    access.quotes
      ? prisma.serviceOrder.count({ where: { workshopId, status: "waiting_approval" } })
      : Promise.resolve(0),
    prisma.serviceOrder.count({
      where: { workshopId, ...overdueDeliveryWhere },
    }),
    access.photoChecklist
      ? prisma.vehicleIntakeForm.findMany({
          where: { workshopId, status: { notIn: NOT_DELIVERED_CANCELLED_INTAKE } },
          select: { id: true },
        })
      : Promise.resolve([]),
    access.cashbox
      ? prisma.collectionPayment.aggregate({
          where: { workshopId, status: "completed", paymentDate: { gte: today } },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
    access.cashbox
      ? prisma.serviceOrder.findMany({
          where: {
            workshopId,
            status: { notIn: ["cancelled"] },
            paymentStatus: { in: ["unpaid", "partial"] },
          },
          include: { items: { select: ORDER_TOTALS_ITEM_SELECT } },
        })
      : Promise.resolve([]),
  ])

  const intakeIds = allActiveIntakes.map((i) => i.id)

  let missingPhotoIntakes = 0
  if (access.photoChecklist && intakeIds.length > 0) {
    const photos = await prisma.vehiclePhoto.findMany({
      where: {
        workshopId,
        intakeFormId: { in: intakeIds },
        type: { in: REQUIRED_PHOTO_TYPES },
        ...VISIBLE_PHOTO,
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
      if (item.unitPrice != null && item.unitPrice > 0) return sum + Math.round(item.unitPrice * quantityToNumber(item.quantity))
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
    todayCollected,
    openReceivable,
    partialPayments,
  }
}

export interface InServiceOrderRow {
  id: string
  status: string
  createdAt: string
  /** Kabulden bu yana geçen tam gün (0 = bugün geldi). */
  daysInService: number
  estimatedDeliveryAt: string | null
  plate: string
  brand: string
  model: string
  customerName: string
}

/**
 * Atölyede en uzun bekleyen araçlar (en eski kabul önce). Kapsam "Serviste"
 * sayacıyla aynı: IN_SERVICE_ORDER_STATUSES — sayaç ile liste ayrışmasın.
 */
export async function getLongestInServiceOrders(
  workshopId: string,
  limit = 5
): Promise<InServiceOrderRow[]> {
  const orders = await prisma.serviceOrder.findMany({
    where: { workshopId, status: { in: IN_SERVICE_ORDER_STATUSES } },
    select: {
      id: true,
      status: true,
      createdAt: true,
      estimatedDeliveryAt: true,
      intakeForm: {
        select: {
          customer: { select: CUSTOMER_NAME_SELECT },
          vehicle: { select: { plate: true, brand: true, model: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  })

  // Date.now() lib'de: sunucu bileşeninin render'ında saf olmayan çağrı olmasın.
  const now = Date.now()
  return orders.map((o) => ({
    id: o.id,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    daysInService: Math.max(0, Math.floor((now - o.createdAt.getTime()) / 86_400_000)),
    estimatedDeliveryAt: o.estimatedDeliveryAt?.toISOString() ?? null,
    plate: o.intakeForm.vehicle.plate,
    brand: o.intakeForm.vehicle.brand,
    model: o.intakeForm.vehicle.model,
    customerName: customerDisplayName(o.intakeForm.customer),
  }))
}

export interface InServiceStatusCount {
  status: OStat
  count: number
}

/**
 * Serviste araçların durumlara dağılımı. Toplamı "Serviste" sayacına eşittir
 * (aynı statü kümesi); yalnız sıfırdan büyük durumlar, iş akışı sırasıyla döner.
 */
export async function getInServiceStatusCounts(workshopId: string): Promise<InServiceStatusCount[]> {
  const groups = await prisma.serviceOrder.groupBy({
    by: ["status"],
    where: { workshopId, status: { in: IN_SERVICE_ORDER_STATUSES } },
    _count: { _all: true },
  })
  const byStatus = new Map(groups.map((g) => [g.status, g._count._all]))
  return IN_SERVICE_ORDER_STATUSES
    .map((status) => ({ status, count: byStatus.get(status) ?? 0 }))
    .filter((s) => s.count > 0)
}

export interface TodayDelivery {
  id: string
  plate: string
  brand: string
  model: string
  customerName: string
  estimatedDeliveryAt: string | null
  status: string
}

/**
 * Bugün teslim edilecek araçlar. Kapsam "Bugün teslim" sayacıyla ve kartın
 * açtığı `/orders?delivery=today` listesiyle aynı tanımdan gelir.
 */
export async function getTodayDeliveries(workshopId: string): Promise<TodayDelivery[]> {
  const orders = await prisma.serviceOrder.findMany({
    where: { workshopId, ...resolveDeliveryFilter(DELIVERY_TODAY).where },
    select: {
      id: true,
      status: true,
      estimatedDeliveryAt: true,
      intakeForm: {
        select: {
          customer: { select: CUSTOMER_NAME_SELECT },
          vehicle: { select: { plate: true, brand: true, model: true } },
        },
      },
    },
    orderBy: { estimatedDeliveryAt: "asc" },
  })

  return orders.map((o) => ({
    id: o.id,
    plate: o.intakeForm.vehicle.plate,
    brand: o.intakeForm.vehicle.brand,
    model: o.intakeForm.vehicle.model,
    customerName: customerDisplayName(o.intakeForm.customer),
    estimatedDeliveryAt: o.estimatedDeliveryAt?.toISOString() ?? null,
    status: o.status,
  }))
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
  const { start: today, end: tomorrow } = istanbulDayBounds()

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

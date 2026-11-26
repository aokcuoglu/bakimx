import { prisma } from "@/lib/db"
import { calculateOrderTotalsFromMinimal, ORDER_TOTALS_ITEM_SELECT } from "@/lib/totals"
import { istanbulDayKey, istanbulMonthStart, istanbulRecentDays, istanbulRecentMonths } from "@/lib/istanbul-time"

// Gün ve ay sınırları ile günlük grafik kovaları Türkiye takvimine göredir,
// sunucunun saat diliminden bağımsız (#874).

// ─── Orders Report ──────────────────────────────────────────────

export interface OrdersReportStats {
  total: number
  open: number
  completed: number
  cancelled: number
}

export interface DailyOrderCount {
  date: string
  label: string
  count: number
}

export interface MonthlyOrderCount {
  month: string
  label: string
  count: number
}

export interface ExpensiveOrderRow {
  id: string
  workOrderNo: string | null
  grandTotal: number
  status: string
  createdAt: string
  customerName: string
  plate: string
}

export interface LongestDurationRow {
  id: string
  workOrderNo: string | null
  durationDays: number
  status: string
  createdAt: string
  completedAt: string | null
  customerName: string
  plate: string
}

export async function getOrdersReportStats(
  workshopId: string,
  dateFrom?: Date,
  /** Aralık sonu, HARİÇ (`lt`) — `istanbulDateRange` bitiş gününün ertesini verir. */
  dateEnd?: Date
): Promise<OrdersReportStats> {
  const where: import("@prisma/client").Prisma.ServiceOrderWhereInput = { workshopId }
  if (dateFrom || dateEnd) {
    where.createdAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateEnd ? { lt: dateEnd } : {}),
    }
  }

  const [total, open, completed, cancelled] = await Promise.all([
    prisma.serviceOrder.count({ where }),
    prisma.serviceOrder.count({
      where: { ...where, status: { notIn: ["delivered", "cancelled"] } },
    }),
    prisma.serviceOrder.count({ where: { ...where, status: "delivered" } }),
    prisma.serviceOrder.count({ where: { ...where, status: "cancelled" } }),
  ])

  return { total, open, completed, cancelled }
}

export async function getDailyOrderCounts(
  workshopId: string,
  days = 30
): Promise<DailyOrderCount[]> {
  const buckets = istanbulRecentDays(days)
  if (buckets.length === 0) return []
  const start = buckets[0].start

  const orders = await prisma.serviceOrder.findMany({
    where: { workshopId, createdAt: { gte: start } },
    select: { createdAt: true },
  })

  const dayNames = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"]
  const dayMap = new Map<string, number>()
  for (const bucket of buckets) {
    dayMap.set(bucket.key, 0)
  }

  for (const o of orders) {
    const key = istanbulDayKey(o.createdAt)
    if (dayMap.has(key)) {
      dayMap.set(key, (dayMap.get(key) || 0) + 1)
    }
  }

  return buckets.map((bucket) => ({
    date: bucket.key,
    label: dayNames[bucket.weekday],
    count: dayMap.get(bucket.key) || 0,
  }))
}

export async function getMonthlyOrderCounts(
  workshopId: string,
  months = 12
): Promise<MonthlyOrderCount[]> {
  const monthNames = [
    "Oca", "Şub", "Mar", "Nis", "May", "Haz",
    "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
  ]

  const results: MonthlyOrderCount[] = []

  for (const bucket of istanbulRecentMonths(months)) {
    const count = await prisma.serviceOrder.count({
      where: {
        workshopId,
        createdAt: { gte: bucket.start, lt: bucket.end },
      },
    })

    results.push({
      month: bucket.key,
      label: `${monthNames[bucket.month]} ${bucket.year}`,
      count,
    })
  }
  return results
}

export async function getExpensiveOrders(
  workshopId: string,
  dateFrom?: Date,
  /** Aralık sonu, HARİÇ (`lt`) — `istanbulDateRange` bitiş gününün ertesini verir. */
  dateEnd?: Date,
  technicianId?: string,
  status?: string,
  customerId?: string,
  limit = 10
): Promise<ExpensiveOrderRow[]> {
  const where: import("@prisma/client").Prisma.ServiceOrderWhereInput = { workshopId }
  if (dateFrom || dateEnd) {
    where.createdAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateEnd ? { lt: dateEnd } : {}),
    }
  }
  if (technicianId) where.assignedTechnicianId = technicianId
  if (status) where.status = status as import("@prisma/client").OrderStatus
  if (customerId) where.intakeForm = { customerId }

  const orders = await prisma.serviceOrder.findMany({
    where,
    include: {
      items: { select: ORDER_TOTALS_ITEM_SELECT },
      intakeForm: {
        include: {
          customer: { select: { firstName: true, lastName: true, fullName: true, companyName: true, type: true } },
          vehicle: { select: { plate: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  const withTotals = orders.map((o) => {
    const total = calculateOrderTotalsFromMinimal(o.items, {
      discountAmount: o.discountAmount,
      taxRate: o.taxRate,
    })
    const cust = o.intakeForm.customer
    const customerName =
      cust.type === "corporate"
        ? cust.companyName || "Kurumsal"
        : cust.fullName || [cust.firstName, cust.lastName].filter(Boolean).join(" ") || "Müşteri"
    return {
      id: o.id,
      workOrderNo: o.workOrderNo,
      grandTotal: total.hasAnyPrice ? total.grandTotal : 0,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      customerName,
      plate: o.intakeForm.vehicle.plate,
    }
  })

  withTotals.sort((a, b) => b.grandTotal - a.grandTotal)
  return withTotals.slice(0, limit)
}

export async function getLongestDurationOrders(
  workshopId: string,
  dateFrom?: Date,
  /** Aralık sonu, HARİÇ (`lt`) — `istanbulDateRange` bitiş gününün ertesini verir. */
  dateEnd?: Date,
  technicianId?: string,
  status?: string,
  customerId?: string,
  limit = 10
): Promise<LongestDurationRow[]> {
  const where: import("@prisma/client").Prisma.ServiceOrderWhereInput = {
    workshopId,
    completedAt: { not: null },
  }
  if (dateFrom || dateEnd) {
    where.createdAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateEnd ? { lt: dateEnd } : {}),
    }
  }
  if (technicianId) where.assignedTechnicianId = technicianId
  if (status) where.status = status as import("@prisma/client").OrderStatus
  if (customerId) where.intakeForm = { customerId }

  const orders = await prisma.serviceOrder.findMany({
    where,
    include: {
      intakeForm: {
        include: {
          customer: { select: { firstName: true, lastName: true, fullName: true, companyName: true, type: true } },
          vehicle: { select: { plate: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  const result = orders
    .map((o) => {
      const completedAt = o.completedAt
      if (!completedAt) return null
      const diffMs = completedAt.getTime() - o.createdAt.getTime()
      const durationDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
      const cust = o.intakeForm.customer
      const customerName =
        cust.type === "corporate"
          ? cust.companyName || "Kurumsal"
          : cust.fullName || [cust.firstName, cust.lastName].filter(Boolean).join(" ") || "Müşteri"
      return {
        id: o.id,
        workOrderNo: o.workOrderNo,
        durationDays,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        completedAt: completedAt.toISOString(),
        customerName,
        plate: o.intakeForm.vehicle.plate,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.durationDays - a.durationDays)

  return result.slice(0, limit)
}

export async function getFilteredOrders(
  workshopId: string,
  options: {
    dateFrom?: Date
    /** Aralık sonu, HARİÇ (`lt`). */
    dateEnd?: Date
    technicianId?: string
    status?: string
    customerId?: string
    limit?: number
  } = {}
) {
  const { dateFrom, dateEnd, technicianId, status, customerId, limit = 10 } = options
  const where: import("@prisma/client").Prisma.ServiceOrderWhereInput = { workshopId }
  if (dateFrom || dateEnd) {
    where.createdAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateEnd ? { lt: dateEnd } : {}),
    }
  }
  if (technicianId) where.assignedTechnicianId = technicianId
  if (status) where.status = status as import("@prisma/client").OrderStatus
  if (customerId) where.intakeForm = { customerId }

  return prisma.serviceOrder.findMany({
    where,
    include: {
      assignedTechnician: { select: { id: true, fullName: true } },
      intakeForm: {
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, fullName: true, companyName: true, type: true, phone: true } },
          vehicle: { select: { plate: true, brand: true, model: true } },
        },
      },
      items: { select: ORDER_TOTALS_ITEM_SELECT },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
}

// ─── Customer Report ─────────────────────────────────────────────

export interface CustomerReportStats {
  total: number
  newThisMonth: number
  returning: number
}

export interface TopCustomerBySpend {
  customerId: string
  customerName: string
  customerPhone: string
  ordersCount: number
  totalSpent: number
}

export interface MostVisitedCustomer {
  customerId: string
  customerName: string
  customerPhone: string
  visitCount: number
}

export async function getCustomerReportStats(
  workshopId: string,
  dateFrom?: Date,
  /** Aralık sonu, HARİÇ (`lt`) — `istanbulDateRange` bitiş gününün ertesini verir. */
  dateEnd?: Date
): Promise<CustomerReportStats> {
  const monthD = istanbulMonthStart()

  const [total, newThisMonth] = await Promise.all([
    prisma.customer.count({ where: { workshopId } }),
    prisma.customer.count({
      where: {
        workshopId,
        createdAt: { gte: dateFrom ?? monthD, ...(dateEnd ? { lt: dateEnd } : {}) },
      },
    }),
  ])

  const customersWithMultipleOrders = await prisma.customer.findMany({
    where: { workshopId },
    include: { _count: { select: { intakes: true } } },
  })
  const returning = customersWithMultipleOrders.filter((c) => c._count.intakes > 1).length

  return { total, newThisMonth, returning }
}

export async function getTopCustomersBySpend(
  workshopId: string,
  limit = 10
): Promise<TopCustomerBySpend[]> {
  const customers = await prisma.customer.findMany({
    where: { workshopId },
    include: {
      intakes: {
        include: {
          order: {
            include: { items: { select: ORDER_TOTALS_ITEM_SELECT } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  const results: TopCustomerBySpend[] = customers
    .map((c) => {
      const orders = c.intakes
        .map((i) => i.order)
        .filter((o): o is NonNullable<typeof o> => o != null && o.status !== "cancelled")

      let totalSpent = 0
      for (const order of orders) {
        const totals = calculateOrderTotalsFromMinimal(order.items, {
          discountAmount: order.discountAmount,
          taxRate: order.taxRate,
        })
        if (totals.hasAnyPrice) totalSpent += totals.grandTotal
      }

      const customerName =
        c.type === "corporate"
          ? c.companyName || "Kurumsal"
          : c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || "Müşteri"

      return {
        customerId: c.id,
        customerName,
        customerPhone: c.phone,
        ordersCount: orders.length,
        totalSpent,
      }
    })
    .filter((r) => r.ordersCount > 0)
    .sort((a, b) => b.totalSpent - a.totalSpent)

  return results.slice(0, limit)
}

export async function getMostVisitedCustomers(
  workshopId: string,
  limit = 10
): Promise<MostVisitedCustomer[]> {
  const customers = await prisma.customer.findMany({
    where: { workshopId },
    include: { _count: { select: { intakes: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return customers
    .filter((c) => c._count.intakes > 0)
    .sort((a, b) => b._count.intakes - a._count.intakes)
    .slice(0, limit)
    .map((c) => ({
      customerId: c.id,
      customerName:
        c.type === "corporate"
          ? c.companyName || "Kurumsal"
          : c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || "Müşteri",
      customerPhone: c.phone,
      visitCount: c._count.intakes,
    }))
}

// ─── Collection Report ──────────────────────────────────────────

export interface CollectionReportStats {
  totalCollected: number
  totalReceivable: number
  overdueReceivable: number
  cashTotal: number
  creditCardTotal: number
  bankTransferTotal: number
  otherTotal: number
}

export interface DailyCollectionCount {
  date: string
  label: string
  amount: number
}

export interface MonthlyCollectionCount {
  month: string
  label: string
  amount: number
}

export async function getCollectionReportStats(
  workshopId: string,
  dateFrom?: Date,
  /** Aralık sonu, HARİÇ (`lt`) — `istanbulDateRange` bitiş gününün ertesini verir. */
  dateEnd?: Date
): Promise<CollectionReportStats> {
  const completedWhere: import("@prisma/client").Prisma.CollectionPaymentWhereInput = {
    workshopId,
    status: "completed",
  }
  if (dateFrom || dateEnd) {
    completedWhere.paymentDate = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateEnd ? { lt: dateEnd } : {}),
    }
  }

  const [cashAgg, creditAgg, bankAgg, otherAgg, receivableOrders] = await Promise.all([
    prisma.collectionPayment.aggregate({
      where: { ...completedWhere, method: "cash" },
      _sum: { amount: true },
    }),
    prisma.collectionPayment.aggregate({
      where: { ...completedWhere, method: "credit_card" },
      _sum: { amount: true },
    }),
    prisma.collectionPayment.aggregate({
      where: { ...completedWhere, method: "bank_transfer" },
      _sum: { amount: true },
    }),
    prisma.collectionPayment.aggregate({
      where: { ...completedWhere, method: "other" },
      _sum: { amount: true },
    }),
    prisma.serviceOrder.findMany({
      where: {
        workshopId,
        status: { notIn: ["cancelled"] },
        paymentStatus: { in: ["unpaid", "partial"] },
      },
      include: { items: { select: ORDER_TOTALS_ITEM_SELECT } },
    }),
  ])

  const totalCollected =
    (cashAgg._sum.amount || 0) +
    (creditAgg._sum.amount || 0) +
    (bankAgg._sum.amount || 0) +
    (otherAgg._sum.amount || 0)

  let totalReceivable = 0
  let overdueReceivable = 0
  const now = new Date()

  for (const order of receivableOrders) {
    const totals = calculateOrderTotalsFromMinimal(order.items, {
      discountAmount: order.discountAmount,
      taxRate: order.taxRate,
    })
    if (!totals.hasAnyPrice) continue
    const paid = order.paidAmount || 0
    const remaining = Math.max(0, totals.grandTotal - paid)
    if (remaining > 0) {
      totalReceivable += remaining
      if (order.estimatedDeliveryAt && new Date(order.estimatedDeliveryAt) < now) {
        overdueReceivable += remaining
      }
    }
  }

  return {
    totalCollected,
    totalReceivable,
    overdueReceivable,
    cashTotal: cashAgg._sum.amount || 0,
    creditCardTotal: creditAgg._sum.amount || 0,
    bankTransferTotal: bankAgg._sum.amount || 0,
    otherTotal: otherAgg._sum.amount || 0,
  }
}

export async function getDailyCollectionAmounts(
  workshopId: string,
  days = 30
): Promise<DailyCollectionCount[]> {
  const buckets = istanbulRecentDays(days)
  if (buckets.length === 0) return []
  const start = buckets[0].start

  const collections = await prisma.collectionPayment.findMany({
    where: {
      workshopId,
      status: "completed",
      paymentDate: { gte: start },
    },
    select: { amount: true, paymentDate: true },
  })

  const dayNames = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"]
  const dayMap = new Map<string, number>()
  for (const bucket of buckets) {
    dayMap.set(bucket.key, 0)
  }

  for (const c of collections) {
    const key = istanbulDayKey(c.paymentDate)
    if (dayMap.has(key)) {
      dayMap.set(key, (dayMap.get(key) || 0) + c.amount)
    }
  }

  return buckets.map((bucket) => ({
    date: bucket.key,
    label: dayNames[bucket.weekday],
    amount: dayMap.get(bucket.key) || 0,
  }))
}

export async function getMonthlyCollectionAmounts(
  workshopId: string,
  months = 12
): Promise<MonthlyCollectionCount[]> {
  const monthNames = [
    "Oca", "Şub", "Mar", "Nis", "May", "Haz",
    "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
  ]

  const results: MonthlyCollectionCount[] = []

  for (const bucket of istanbulRecentMonths(months)) {
    const agg = await prisma.collectionPayment.aggregate({
      where: {
        workshopId,
        status: "completed",
        paymentDate: { gte: bucket.start, lt: bucket.end },
      },
      _sum: { amount: true },
    })

    results.push({
      month: bucket.key,
      label: `${monthNames[bucket.month]} ${bucket.year}`,
      amount: agg._sum.amount || 0,
    })
  }
  return results
}

// ─── Parts Report ───────────────────────────────────────────────

export interface PartsReportStats {
  stockValue: number
  criticalStockCount: number
  outOfStockCount: number
  totalParts: number
}

export interface MostUsedPart {
  partId: string
  name: string
  sku: string | null
  totalUsed: number
}

export interface LowestStockPart {
  id: string
  name: string
  sku: string | null
  stockQty: number
  criticalStockQty: number
  salePrice: number | null
  status: "critical" | "out_of_stock"
}

export async function getPartsReportStats(workshopId: string): Promise<PartsReportStats> {
  const parts = await prisma.partStockItem.findMany({
    where: { workshopId, isActive: true },
    select: {
      stockQty: true,
      criticalStockQty: true,
      purchasePrice: true,
      salePrice: true,
    },
  })

  let stockValue = 0
  let criticalStockCount = 0
  let outOfStockCount = 0

  for (const p of parts) {
    const unitValue = p.purchasePrice ?? p.salePrice ?? 0
    stockValue += unitValue * p.stockQty
    if (p.stockQty <= 0) outOfStockCount++
    else if (p.stockQty <= p.criticalStockQty) criticalStockCount++
  }

  return { stockValue, criticalStockCount, outOfStockCount, totalParts: parts.length }
}

export async function getMostUsedParts(
  workshopId: string,
  limit = 10
): Promise<MostUsedPart[]> {
  const movements = await prisma.stockMovement.findMany({
    where: { workshopId, type: "out" },
    include: { part: { select: { id: true, name: true, sku: true } } },
  })

  const usageMap = new Map<string, { partId: string; name: string; sku: string | null; totalUsed: number }>()
  for (const m of movements) {
    if (!m.part) continue
    const existing = usageMap.get(m.partId)
    if (existing) {
      existing.totalUsed += m.quantity
    } else {
      usageMap.set(m.partId, {
        partId: m.partId,
        name: m.part.name,
        sku: m.part.sku,
        totalUsed: m.quantity,
      })
    }
  }

  return Array.from(usageMap.values())
    .sort((a, b) => b.totalUsed - a.totalUsed)
    .slice(0, limit)
}

export async function getLowestStockParts(
  workshopId: string,
  limit = 10
): Promise<LowestStockPart[]> {
  const parts = await prisma.partStockItem.findMany({
    where: { workshopId, isActive: true },
    select: { id: true, name: true, sku: true, stockQty: true, criticalStockQty: true, salePrice: true },
    orderBy: { stockQty: "asc" },
    take: limit * 3,
  })

  const critical = parts.filter((p) => p.stockQty <= 0 || p.stockQty <= p.criticalStockQty)
  return critical.slice(0, limit).map((p) => ({
    ...p,
    status: p.stockQty <= 0 ? ("out_of_stock" as const) : ("critical" as const),
  }))
}

// ─── Technician Report ──────────────────────────────────────────

export interface TechnicianReportStats {
  totalAssigned: number
  totalCompleted: number
  avgCompletionDays: number | null
}

export interface TechnicianPerformanceRow {
  id: string
  fullName: string
  role: string
  assignedJobs: number
  completedJobs: number
  avgCompletionDays: number | null
  activeJobs: number
}

export async function getTechnicianReportStats(
  workshopId: string
): Promise<TechnicianReportStats> {
  const [totalAssigned, totalCompleted, completedOrders] = await Promise.all([
    prisma.serviceOrder.count({
      where: { workshopId, assignedTechnicianId: { not: null }, status: { notIn: ["cancelled"] } },
    }),
    prisma.serviceOrder.count({
      where: { workshopId, assignedTechnicianId: { not: null }, status: "delivered" },
    }),
    prisma.serviceOrder.findMany({
      where: {
        workshopId,
        assignedTechnicianId: { not: null },
        status: "delivered",
        completedAt: { not: null },
      },
      select: { createdAt: true, completedAt: true },
    }),
  ])

  let avgCompletionDays: number | null = null
  if (completedOrders.length > 0) {
    const totalDays = completedOrders.reduce((sum, o) => {
      if (!o.completedAt) return sum
      return sum + (o.completedAt.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    }, 0)
    avgCompletionDays = Math.round(totalDays / completedOrders.length * 10) / 10
  }

  return { totalAssigned, totalCompleted, avgCompletionDays }
}

export async function getTechnicianPerformance(
  workshopId: string
): Promise<TechnicianPerformanceRow[]> {
  const technicians = await prisma.technician.findMany({
    where: { workshopId, isActive: true },
    include: {
      assignedOrders: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          completedAt: true,
        },
      },
    },
    orderBy: { fullName: "asc" },
  })

  return technicians.map((t) => {
    const assignedJobs = t.assignedOrders.length
    const completedOrders = t.assignedOrders.filter((o) => o.status === "delivered")
    const completedJobs = completedOrders.length
    const activeJobs = t.assignedOrders.filter(
      (o) => o.status !== "delivered" && o.status !== "cancelled"
    ).length

    let avgCompletionDays: number | null = null
    const withCompletionDate = completedOrders.filter((o) => o.completedAt)
    if (withCompletionDate.length > 0) {
      const totalDays = withCompletionDate.reduce((sum, o) => {
        return sum + (o.completedAt!.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      }, 0)
      avgCompletionDays = Math.round(totalDays / withCompletionDate.length * 10) / 10
    }

    return {
      id: t.id,
      fullName: t.fullName,
      role: t.role,
      assignedJobs,
      completedJobs,
      avgCompletionDays,
      activeJobs,
    }
  })
}

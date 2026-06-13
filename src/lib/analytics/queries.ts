import { prisma } from "@/lib/db"
import { calculateMinimalTotal } from "@/lib/totals"
import { customerDisplayName } from "@/lib/format"

type OStat = import("@prisma/client").OrderStatus
const NOT_DELIVERED_CANCELLED: OStat[] = ["delivered", "cancelled"]

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

// ─── 1. Operations Health Dashboard ──────────────────────────

export interface OperationsHealth {
  healthScore: number
  activeJobs: number
  delayedJobs: number
  waitingApprovals: number
  criticalStock: number
  openReceivables: number
  unpaidWorkOrders: number
  overdueJobs: number
}

export async function getOperationsHealth(workshopId: string): Promise<OperationsHealth> {
  const today = todayStart()

  const [
    activeJobs,
    delayedOrders,
    waitingApprovals,
    criticalStockParts,
    receivableOrders,
  ] = await Promise.all([
    prisma.serviceOrder.count({
      where: { workshopId, status: { notIn: NOT_DELIVERED_CANCELLED } },
    }),
    prisma.serviceOrder.findMany({
      where: {
        workshopId,
        status: { notIn: NOT_DELIVERED_CANCELLED },
        estimatedDeliveryAt: { lt: today },
      },
      select: { id: true },
    }),
    prisma.serviceOrder.count({
      where: { workshopId, status: "waiting_approval" },
    }),
    prisma.partStockItem.findMany({
      where: { workshopId, isActive: true },
      select: { stockQty: true, criticalStockQty: true },
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

  const delayedJobs = delayedOrders.length
  const criticalStock = criticalStockParts.filter(
    (p) => p.stockQty <= p.criticalStockQty
  ).length

  let openReceivables = 0
  let unpaidWorkOrders = 0
  for (const order of receivableOrders) {
    const total = calculateMinimalTotal(order.items)
    const discount = order.discountAmount ?? 0
    const subtotal = Math.max(0, total - discount)
    const taxRate = order.taxRate ?? 0
    const grandTotal = subtotal + (subtotal * taxRate) / 100
    const paid = order.paidAmount || 0
    const remaining = Math.max(0, grandTotal - paid)
    if (remaining > 0) {
      openReceivables += remaining
      unpaidWorkOrders++
    }
  }

  const overdueJobs = delayedJobs

  let healthScore = 100
  healthScore -= Math.min(30, overdueJobs * 5)
  healthScore -= Math.min(25, criticalStock * 4)
  healthScore -= Math.min(20, unpaidWorkOrders * 3)
  healthScore -= Math.min(15, waitingApprovals * 2)
  healthScore = Math.max(0, Math.min(100, healthScore))

  return {
    healthScore,
    activeJobs,
    delayedJobs,
    waitingApprovals,
    criticalStock,
    openReceivables,
    unpaidWorkOrders,
    overdueJobs,
  }
}

// ─── 2. Delayed Jobs ─────────────────────────────────────────

export interface DelayedJobRow {
  id: string
  workOrderNo: string
  daysDelayed: number
  status: string
  estimatedDeliveryAt: string | null
  createdAt: string
  customerName: string
  customerPhone: string
  plate: string
  brand: string
  model: string
  technicianName: string | null
  total: number
}

export async function getDelayedJobs(
  workshopId: string,
  limit = 20
): Promise<DelayedJobRow[]> {
  const today = todayStart()

  const orders = await prisma.serviceOrder.findMany({
    where: {
      workshopId,
      status: { notIn: NOT_DELIVERED_CANCELLED },
      estimatedDeliveryAt: { lt: today },
    },
    include: {
      intakeForm: {
        include: {
          customer: { select: { firstName: true, lastName: true, fullName: true, companyName: true, type: true, phone: true } },
          vehicle: { select: { plate: true, brand: true, model: true } },
        },
      },
      assignedTechnician: { select: { fullName: true } },
      items: { select: { totalPrice: true, unitPrice: true, quantity: true, type: true } },
    },
    orderBy: { estimatedDeliveryAt: "asc" },
    take: limit,
  })

  return orders.map((o) => {
    const delivery = o.estimatedDeliveryAt ? new Date(o.estimatedDeliveryAt) : null
    const daysDelayed = delivery
      ? Math.floor((today.getTime() - delivery.getTime()) / (1000 * 60 * 60 * 24))
      : 0

    const total = calculateMinimalTotal(o.items)
    const discount = o.discountAmount ?? 0
    const subtotal = Math.max(0, total - discount)
    const taxRate = o.taxRate ?? 0
    const grandTotal = subtotal + (subtotal * taxRate) / 100

    const cust = o.intakeForm.customer

    return {
      id: o.id,
      workOrderNo: o.workOrderNo || `BX-${o.id.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase()}`,
      daysDelayed,
      status: o.status,
      estimatedDeliveryAt: o.estimatedDeliveryAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
      customerName: customerDisplayName(cust),
      customerPhone: cust.phone,
      plate: o.intakeForm.vehicle.plate,
      brand: o.intakeForm.vehicle.brand,
      model: o.intakeForm.vehicle.model,
      technicianName: o.assignedTechnician?.fullName || o.technicianName || null,
      total: grandTotal,
    }
  })
}

// ─── 3. Technician Analytics ──────────────────────────────────

export interface TechnicianAnalyticsRow {
  id: string
  fullName: string
  role: string
  activeJobs: number
  completedJobs: number
  avgCompletionDays: number | null
  totalAssigned: number
}

export interface TechnicianRanking {
  fastest: TechnicianAnalyticsRow[]
  busiest: TechnicianAnalyticsRow[]
}

export async function getTechnicianAnalytics(
  workshopId: string
): Promise<TechnicianRanking> {
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

  const rows: TechnicianAnalyticsRow[] = technicians.map((t) => {
    const totalAssigned = t.assignedOrders.length
    const completedOrders = t.assignedOrders.filter((o) => o.status === "delivered")
    const completedJobs = completedOrders.length
    const activeJobs = t.assignedOrders.filter(
      (o) => o.status !== "delivered" && o.status !== "cancelled"
    ).length

    const withCompletion = completedOrders.filter((o) => o.completedAt)
    let avgCompletionDays: number | null = null
    if (withCompletion.length > 0) {
      const totalDays = withCompletion.reduce((sum, o) => {
        return sum + (o.completedAt!.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      }, 0)
      avgCompletionDays = Math.round((totalDays / withCompletion.length) * 10) / 10
    }

    return {
      id: t.id,
      fullName: t.fullName,
      role: t.role,
      activeJobs,
      completedJobs,
      avgCompletionDays,
      totalAssigned,
    }
  })

  const fastest = [...rows]
    .filter((r) => r.avgCompletionDays !== null && r.completedJobs > 0)
    .sort((a, b) => (a.avgCompletionDays ?? Infinity) - (b.avgCompletionDays ?? Infinity))
    .slice(0, 5)

  const busiest = [...rows]
    .filter((r) => r.activeJobs > 0)
    .sort((a, b) => b.activeJobs - a.activeJobs)
    .slice(0, 5)

  return { fastest, busiest }
}

// ─── 4. Customer Analytics ─────────────────────────────────────

export interface CustomerAnalytics {
  totalCustomers: number
  newThisMonth: number
  repeatCustomerRate: number
  inactiveCustomers: number
  highValueCustomers: HighValueCustomer[]
}

export interface HighValueCustomer {
  id: string
  name: string
  phone: string
  totalSpent: number
  orderCount: number
}

export async function getCustomerAnalytics(workshopId: string): Promise<CustomerAnalytics> {
  const monthD = monthStart()
  const ninetyDaysAgo = daysAgo(90)

  const [totalCustomers, newThisMonth, allCustomers] = await Promise.all([
    prisma.customer.count({ where: { workshopId } }),
    prisma.customer.count({
      where: { workshopId, createdAt: { gte: monthD } },
    }),
    prisma.customer.findMany({
      where: { workshopId },
      include: {
        intakes: {
          include: {
            order: {
              include: {
                items: { select: { totalPrice: true, unitPrice: true, quantity: true, type: true } },
              },
            },
          },
        },
      },
    }),
  ])

  let repeatCount = 0
  let inactiveCount = 0
  const spending: HighValueCustomer[] = []

  for (const c of allCustomers) {
    const orders = c.intakes
      .map((i) => i.order)
      .filter((o): o is NonNullable<typeof o> => o != null && o.status !== "cancelled")

    if (orders.length > 1) repeatCount++

    const hasRecentOrder = c.intakes.some(
      (i) => i.createdAt >= ninetyDaysAgo
    )
    if (!hasRecentOrder && c.intakes.length > 0) inactiveCount++

    let totalSpent = 0
    for (const order of orders) {
      const lineTotal = calculateMinimalTotal(order.items)
      const discount = order.discountAmount ?? 0
      const subtotal = Math.max(0, lineTotal - discount)
      const taxRate = order.taxRate ?? 0
      totalSpent += subtotal + (subtotal * taxRate) / 100
    }

    if (orders.length > 0) {
      spending.push({
        id: c.id,
        name: customerDisplayName(c),
        phone: c.phone,
        totalSpent,
        orderCount: orders.length,
      })
    }
  }

  const repeatCustomerRate = totalCustomers > 0
    ? Math.round((repeatCount / totalCustomers) * 100)
    : 0

  const highValueCustomers = spending
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 10)

  return {
    totalCustomers,
    newThisMonth,
    repeatCustomerRate,
    inactiveCustomers: inactiveCount,
    highValueCustomers,
  }
}

// ─── 5. Parts Analytics ────────────────────────────────────────

export interface PartsAnalytics {
  totalParts: number
  stockValue: number
  criticalStockCount: number
  outOfStockCount: number
  mostConsumed: MostConsumedPart[]
  stockRiskList: StockRiskItem[]
}

export interface MostConsumedPart {
  partId: string
  name: string
  sku: string | null
  totalUsed: number
  category: string | null
}

export interface StockRiskItem {
  id: string
  name: string
  sku: string | null
  stockQty: number
  criticalStockQty: number
  salePrice: number | null
  category: string | null
  status: "critical" | "out_of_stock"
}

export async function getPartsAnalytics(workshopId: string): Promise<PartsAnalytics> {
  const [parts, movements] = await Promise.all([
    prisma.partStockItem.findMany({
      where: { workshopId, isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQty: true,
        criticalStockQty: true,
        purchasePrice: true,
        salePrice: true,
        category: true,
      },
    }),
    prisma.stockMovement.findMany({
      where: { workshopId, type: "out" },
      include: { part: { select: { id: true, name: true, sku: true, category: true } } },
    }),
  ])

  let stockValue = 0
  let criticalStockCount = 0
  let outOfStockCount = 0
  const stockRiskList: StockRiskItem[] = []

  for (const p of parts) {
    const unitValue = p.purchasePrice ?? p.salePrice ?? 0
    stockValue += unitValue * p.stockQty

    if (p.stockQty <= 0) {
      outOfStockCount++
      stockRiskList.push({
        ...p,
        status: "out_of_stock",
      })
    } else if (p.stockQty <= p.criticalStockQty) {
      criticalStockCount++
      stockRiskList.push({
        ...p,
        status: "critical",
      })
    }
  }

  stockRiskList.sort((a, b) => a.stockQty - b.stockQty)

  const usageMap = new Map<string, { partId: string; name: string; sku: string | null; category: string | null; totalUsed: number }>()
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
        category: m.part.category,
        totalUsed: m.quantity,
      })
    }
  }

  const mostConsumed = Array.from(usageMap.values())
    .sort((a, b) => b.totalUsed - a.totalUsed)
    .slice(0, 10)

  return {
    totalParts: parts.length,
    stockValue,
    criticalStockCount,
    outOfStockCount,
    mostConsumed,
    stockRiskList: stockRiskList.slice(0, 20),
  }
}

// ─── 6. Revenue Analytics ─────────────────────────────────────

export interface RevenueAnalytics {
  totalCollected: number
  totalReceivable: number
  averageTicketSize: number
  revenuePerWorkOrder: number
  collectionTrend: MonthlyCollectionEntry[]
  completedOrders: number
  totalOrders: number
}

export interface MonthlyCollectionEntry {
  month: string
  label: string
  amount: number
}

export async function getRevenueAnalytics(workshopId: string): Promise<RevenueAnalytics> {
  const monthNames = [
    "Oca", "Şub", "Mar", "Nis", "May", "Haz",
    "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
  ]

  const now = new Date()

  const [completedCollections, receivableOrders, completedOrders, totalOrders] = await Promise.all([
    prisma.collectionPayment.findMany({
      where: { workshopId, status: "completed" },
      select: { amount: true, paymentDate: true },
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
    prisma.serviceOrder.findMany({
      where: {
        workshopId,
        status: "delivered",
        paymentStatus: { notIn: ["cancelled"] },
      },
      include: {
        items: { select: { totalPrice: true, unitPrice: true, quantity: true, type: true } },
      },
    }),
    prisma.serviceOrder.count({
      where: { workshopId, status: { notIn: ["cancelled"] } },
    }),
  ])

  const totalCollected = completedCollections.reduce((sum, c) => sum + c.amount, 0)

  let totalReceivable = 0
  for (const order of receivableOrders) {
    const lineTotal = calculateMinimalTotal(order.items)
    const discount = order.discountAmount ?? 0
    const subtotal = Math.max(0, lineTotal - discount)
    const taxRate = order.taxRate ?? 0
    const grandTotal = subtotal + (subtotal * taxRate) / 100
    const paid = order.paidAmount || 0
    totalReceivable += Math.max(0, grandTotal - paid)
  }

  let totalRevenue = 0
  let orderCount = 0
  for (const order of completedOrders) {
    const lineTotal = calculateMinimalTotal(order.items)
    const discount = order.discountAmount ?? 0
    const subtotal = Math.max(0, lineTotal - discount)
    const taxRate = order.taxRate ?? 0
    const grandTotal = subtotal + (subtotal * taxRate) / 100
    if (grandTotal > 0) {
      totalRevenue += grandTotal
      orderCount++
    }
  }

  const averageTicketSize = orderCount > 0 ? Math.round((totalRevenue / orderCount) * 100) / 100 : 0
  const revenuePerWorkOrder = totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0

  const collectionMap = new Map<string, number>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    collectionMap.set(key, 0)
  }

  for (const c of completedCollections) {
    const key = c.paymentDate.toISOString().slice(0, 7)
    if (collectionMap.has(key)) {
      collectionMap.set(key, (collectionMap.get(key) || 0) + c.amount)
    }
  }

  const collectionTrend: MonthlyCollectionEntry[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    collectionTrend.push({
      month: key,
      label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      amount: collectionMap.get(key) || 0,
    })
  }

  return {
    totalCollected,
    totalReceivable,
    averageTicketSize,
    revenuePerWorkOrder,
    collectionTrend,
    completedOrders: orderCount,
    totalOrders,
  }
}

// ─── 7. Service Analytics ─────────────────────────────────────

export interface ServiceAnalytics {
  topComplaints: ComplaintRow[]
  topRepairs: RepairRow[]
  topLaborItems: LaborRow[]
}

export interface ComplaintRow {
  complaint: string
  count: number
}

export interface RepairRow {
  itemName: string
  count: number
  type: string
}

export interface LaborRow {
  laborName: string
  count: number
  totalRevenue: number
}

export async function getServiceAnalytics(workshopId: string): Promise<ServiceAnalytics> {
  const [intakes, orderItems] = await Promise.all([
    prisma.vehicleIntakeForm.findMany({
      where: { workshopId },
      select: { customerComplaint: true },
    }),
    prisma.serviceOrderItem.findMany({
      where: { workshopId },
      select: { name: true, type: true, quantity: true, unitPrice: true, totalPrice: true },
    }),
  ])

  const complaintMap = new Map<string, number>()
  for (const i of intakes) {
    const complaint = i.customerComplaint?.trim()
    if (complaint) {
      const normalized = complaint.toLowerCase().replace(/\s+/g, " ")
      complaintMap.set(normalized, (complaintMap.get(normalized) || 0) + 1)
    }
  }

  const topComplaints = Array.from(complaintMap.entries())
    .map(([complaint, count]) => ({
      complaint: complaint.charAt(0).toUpperCase() + complaint.slice(1),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const repairMap = new Map<string, { count: number; type: string }>()
  for (const item of orderItems) {
    const key = item.name.trim().toLowerCase()
    if (!key) continue
    const existing = repairMap.get(key)
    if (existing) {
      existing.count += item.quantity
    } else {
      repairMap.set(key, { count: item.quantity, type: item.type })
    }
  }

  const topRepairs = Array.from(repairMap.entries())
    .map(([itemName, data]) => ({
      itemName: itemName.charAt(0).toUpperCase() + itemName.slice(1),
      count: data.count,
      type: data.type,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const laborMap = new Map<string, { count: number; totalRevenue: number }>()
  for (const item of orderItems) {
    if (item.type !== "labor") continue
    const key = item.name.trim().toLowerCase()
    if (!key) continue
    const lineTotal = (item.totalPrice != null && item.totalPrice > 0)
      ? item.totalPrice
      : (item.unitPrice != null && item.unitPrice > 0)
        ? item.unitPrice * item.quantity
        : 0

    const existing = laborMap.get(key)
    if (existing) {
      existing.count += item.quantity
      existing.totalRevenue += lineTotal
    } else {
      laborMap.set(key, { count: item.quantity, totalRevenue: lineTotal })
    }
  }

  const topLaborItems = Array.from(laborMap.entries())
    .map(([laborName, data]) => ({
      laborName: laborName.charAt(0).toUpperCase() + laborName.slice(1),
      count: data.count,
      totalRevenue: data.totalRevenue,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10)

  return { topComplaints, topRepairs, topLaborItems }
}

// ─── 8. Recommendation Engine ─────────────────────────────────

export interface Recommendation {
  id: string
  type: "warning" | "info" | "success"
  category: string
  message: string
}

export async function getRecommendations(workshopId: string): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = []
  let id = 0

  const [
    delayedOrders,
    health,
    customers,
  ] = await Promise.all([
    getDelayedJobs(workshopId, 50),
    getOperationsHealth(workshopId),
    getCustomerAnalytics(workshopId),
  ])

  if (delayedOrders.length > 0) {
    const longDelayed = delayedOrders.filter((d) => d.daysDelayed > 3)
    if (longDelayed.length > 0) {
      recommendations.push({
        id: `rec-${++id}`,
        type: "warning",
        category: "delayed",
        message: `${longDelayed.length} iş emri 3 günden fazla gecikmiş durumda.`,
      })
    }
    recommendations.push({
      id: `rec-${++id}`,
      type: delayedOrders.length > 3 ? "warning" : "info",
      category: "delayed",
      message: `${delayedOrders.length} iş emri tahmini teslim tarihini geçti.`,
    })
  }

  if (health.criticalStock > 0) {
    recommendations.push({
      id: `rec-${++id}`,
      type: "warning",
      category: "stock",
      message: `${health.criticalStock} parça stok uyarı seviyesinde veya altında.`,
    })
  }

  if (health.unpaidWorkOrders > 0) {
    recommendations.push({
      id: `rec-${++id}`,
      type: "info",
      category: "revenue",
      message: `${health.unpaidWorkOrders} iş emrinin ödemesi henüz alınmamış.`,
    })
  }

  if (health.waitingApprovals > 3) {
    recommendations.push({
      id: `rec-${++id}`,
      type: "info",
      category: "approvals",
      message: `${health.waitingApprovals} iş emri müşteri onayı bekliyor.`,
    })
  }

  if (customers.inactiveCustomers > 0) {
    recommendations.push({
      id: `rec-${++id}`,
      type: "info",
      category: "customers",
      message: `${customers.inactiveCustomers} müşteri 90 gündür aktif değil.`,
    })
  }

  if (customers.repeatCustomerRate >= 40) {
    recommendations.push({
      id: `rec-${++id}`,
      type: "success",
      category: "customers",
      message: `Müşteri geri dönüş oranı %${customers.repeatCustomerRate} — iyi seviye.`,
    })
  } else if (customers.repeatCustomerRate > 0 && customers.repeatCustomerRate < 20) {
    recommendations.push({
      id: `rec-${++id}`,
      type: "warning",
      category: "customers",
      message: `Müşteri geri dönüş oranı %${customers.repeatCustomerRate} — düşük seviye.`,
    })
  }

  if (health.healthScore >= 80) {
    recommendations.push({
      id: `rec-${++id}`,
      type: "success",
      category: "health",
      message: `Operasyonel sağlık skoru ${health.healthScore}/100 — iyi durumda.`,
    })
  } else if (health.healthScore < 50) {
    recommendations.push({
      id: `rec-${++id}`,
      type: "warning",
      category: "health",
      message: `Operasyonel sağlık skoru ${health.healthScore}/100 — dikkat gerekiyor.`,
    })
  }

  return recommendations
}
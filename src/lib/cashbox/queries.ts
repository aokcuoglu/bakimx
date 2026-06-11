import { prisma } from "@/lib/db"
import { calculateOrderTotalsFromMinimal } from "@/lib/totals"

export type CashboxStats = {
  todayCollected: number
  monthCollected: number
  openReceivable: number
  overdueReceivable: number
  partialPayments: number
  totalCollectionCount: number
}

export type RecentCollection = {
  id: string
  amount: number
  method: string
  status: string
  paymentDate: string
  referenceNo: string | null
  note: string | null
  customer: {
    id: string
    type: string
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    phone: string
  }
  serviceOrder: {
    id: string
    workOrderNo: string | null
    vehicle: { plate: string; brand: string; model: string }
  } | null
}

export type OpenReceivable = {
  id: string
  workOrderNo: string | null
  status: string
  paymentStatus: string
  grandTotal: number
  paidAmount: number
  remainingAmount: number
  estimatedDeliveryAt: string | null
  createdAt: string
  customer: {
    id: string
    type: string
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    phone: string
  }
  vehicle: { plate: string; brand: string; model: string }
}

export type PaymentMethodBreakdown = {
  method: string
  label: string
  count: number
  total: number
}

function todayStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
}

function monthStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
}

export async function getCashboxStats(workshopId: string): Promise<CashboxStats> {
  const today = todayStart()
  const monthStartD = monthStart()

  const [
    todayCollections,
    monthCollections,
    allCompletedCollections,
    activeOrders,
  ] = await Promise.all([
    prisma.collectionPayment.aggregate({
      where: {
        workshopId,
        status: "completed",
        paymentDate: { gte: today },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.collectionPayment.aggregate({
      where: {
        workshopId,
        status: "completed",
        paymentDate: { gte: monthStartD },
      },
      _sum: { amount: true },
    }),
    prisma.collectionPayment.findMany({
      where: { workshopId, status: "completed" },
      select: { amount: true, serviceOrderId: true },
    }),
    prisma.serviceOrder.findMany({
      where: {
        workshopId,
        status: { notIn: ["cancelled"] },
        paymentStatus: { in: ["unpaid", "partial"] },
      },
      include: {
        items: { select: { totalPrice: true, unitPrice: true, quantity: true } },
        intakeForm: { select: { customer: true, vehicle: true } },
      },
    }),
  ])

  const todayCollected = todayCollections._sum.amount || 0
  const monthCollected = monthCollections._sum.amount || 0

  const paidByOrder = new Map<string, number>()
  for (const c of allCompletedCollections) {
    if (c.serviceOrderId) {
      paidByOrder.set(c.serviceOrderId, (paidByOrder.get(c.serviceOrderId) || 0) + c.amount)
    }
  }

  let openReceivable = 0
  let overdueReceivable = 0
  let partialPayments = 0
  const now = new Date()

  for (const order of activeOrders) {
    const totals = calculateOrderTotalsFromMinimal(order.items, {
      discountAmount: order.discountAmount,
      taxRate: order.taxRate,
    })
    if (!totals.hasAnyPrice) continue
    const grandTotal = totals.grandTotal
    const paid = paidByOrder.get(order.id) || order.paidAmount || 0
    const remaining = Math.max(0, grandTotal - paid)
    if (remaining > 0) {
      openReceivable += remaining
      if (order.paymentStatus === "partial") partialPayments++
      if (order.estimatedDeliveryAt && new Date(order.estimatedDeliveryAt) < now) {
        overdueReceivable += remaining
      }
    }
  }

  return {
    todayCollected,
    monthCollected,
    openReceivable,
    overdueReceivable,
    partialPayments,
    totalCollectionCount: todayCollections._count ?? 0,
  }
}

export async function getRecentCollections(
  workshopId: string,
  limit = 20
): Promise<RecentCollection[]> {
  const collections = await prisma.collectionPayment.findMany({
    where: { workshopId },
    include: {
      customer: {
        select: { id: true, type: true, firstName: true, lastName: true, fullName: true, companyName: true, phone: true },
      },
      serviceOrder: {
        select: {
          id: true,
          workOrderNo: true,
          intakeForm: { select: { vehicle: { select: { plate: true, brand: true, model: true } } } },
        },
      },
    },
    orderBy: { paymentDate: "desc" },
    take: limit,
  })

  return collections.map((c) => ({
    id: c.id,
    amount: c.amount,
    method: c.method,
    status: c.status,
    paymentDate: c.paymentDate.toISOString(),
    referenceNo: c.referenceNo,
    note: c.note,
    customer: {
      id: c.customer.id,
      type: c.customer.type,
      firstName: c.customer.firstName,
      lastName: c.customer.lastName,
      fullName: c.customer.fullName,
      companyName: c.customer.companyName,
      phone: c.customer.phone,
    },
    serviceOrder: c.serviceOrder
      ? {
          id: c.serviceOrder.id,
          workOrderNo: c.serviceOrder.workOrderNo,
          vehicle: c.serviceOrder.intakeForm.vehicle,
        }
      : null,
  }))
}

export async function getOpenReceivables(workshopId: string, limit = 50): Promise<OpenReceivable[]> {
  const orders = await prisma.serviceOrder.findMany({
    where: {
      workshopId,
      status: { notIn: ["cancelled"] },
      paymentStatus: { in: ["unpaid", "partial"] },
    },
    include: {
      items: { select: { totalPrice: true, unitPrice: true, quantity: true, type: true } },
      intakeForm: {
        select: {
          customer: { select: { id: true, type: true, firstName: true, lastName: true, fullName: true, companyName: true, phone: true } },
          vehicle: { select: { plate: true, brand: true, model: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  const allCompletedCollections = await prisma.collectionPayment.findMany({
    where: { workshopId, status: "completed", serviceOrderId: { in: orders.map((o) => o.id) } },
    select: { serviceOrderId: true, amount: true },
  })

  const paidByOrder = new Map<string, number>()
  for (const c of allCompletedCollections) {
    if (c.serviceOrderId) {
      paidByOrder.set(c.serviceOrderId, (paidByOrder.get(c.serviceOrderId) || 0) + c.amount)
    }
  }

  return orders.map((o) => {
    const totals = calculateOrderTotalsFromMinimal(o.items, {
      discountAmount: o.discountAmount,
      taxRate: o.taxRate,
    })
    const paid = paidByOrder.get(o.id) || o.paidAmount || 0
    const remaining = Math.max(0, totals.grandTotal - paid)

    return {
      id: o.id,
      workOrderNo: o.workOrderNo,
      status: o.status,
      paymentStatus: o.paymentStatus,
      grandTotal: totals.grandTotal,
      paidAmount: paid,
      remainingAmount: remaining,
      estimatedDeliveryAt: o.estimatedDeliveryAt?.toISOString() || null,
      createdAt: o.createdAt.toISOString(),
      customer: {
        id: o.intakeForm.customer.id,
        type: o.intakeForm.customer.type,
        firstName: o.intakeForm.customer.firstName,
        lastName: o.intakeForm.customer.lastName,
        fullName: o.intakeForm.customer.fullName,
        companyName: o.intakeForm.customer.companyName,
        phone: o.intakeForm.customer.phone,
      },
      vehicle: o.intakeForm.vehicle,
    }
  })
}

export async function getPaymentMethodBreakdown(workshopId: string): Promise<PaymentMethodBreakdown[]> {
  const results = await prisma.collectionPayment.groupBy({
    by: ["method"],
    where: { workshopId, status: "completed" },
    _sum: { amount: true },
    _count: true,
  })

  const labels: Record<string, string> = {
    cash: "Nakit",
    credit_card: "Kredi Kartı",
    bank_transfer: "Havale/EFT",
    other: "Diğer",
  }

  return results.map((r) => ({
    method: r.method,
    label: labels[r.method] || r.method,
    count: r._count,
    total: r._sum.amount || 0,
  }))
}

export type CollectionListRow = {
  id: string
  amount: number
  method: string
  status: string
  paymentDate: string
  referenceNo: string | null
  note: string | null
  customer: {
    id: string
    type: string
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    phone: string
  }
  serviceOrder: {
    id: string
    workOrderNo: string | null
    vehicle: { plate: string; brand: string; model: string }
  } | null
}

export async function getCollections(
  workshopId: string,
  options: {
    q?: string
    method?: string
    status?: string
    dateFrom?: Date
    dateTo?: Date
    limit?: number
    offset?: number
  } = {}
): Promise<{ rows: CollectionListRow[]; total: number }> {
  const { q, method, status, dateFrom, dateTo, limit = 100, offset = 0 } = options

  const where: import("@prisma/client").Prisma.CollectionPaymentWhereInput = {
    workshopId,
  }

  if (method) where.method = method as import("@prisma/client").PaymentMethod
  if (status) where.status = status as import("@prisma/client").CollectionStatus
  if (dateFrom || dateTo) {
    where.paymentDate = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lt: new Date(dateTo.getTime() + 86400000) } : {}),
    }
  }

  if (q) {
    where.OR = [
      { referenceNo: { contains: q, mode: "insensitive" } },
      { note: { contains: q, mode: "insensitive" } },
      { customer: { firstName: { contains: q, mode: "insensitive" } } },
      { customer: { lastName: { contains: q, mode: "insensitive" } } },
      { customer: { fullName: { contains: q, mode: "insensitive" } } },
      { customer: { companyName: { contains: q, mode: "insensitive" } } },
      { customer: { phone: { contains: q } } },
      { serviceOrder: { workOrderNo: { contains: q, mode: "insensitive" } } },
    ]
  }

  const [rows, total] = await Promise.all([
    prisma.collectionPayment.findMany({
      where,
      include: {
        customer: { select: { id: true, type: true, firstName: true, lastName: true, fullName: true, companyName: true, phone: true } },
        serviceOrder: {
          select: {
            id: true,
            workOrderNo: true,
            intakeForm: { select: { vehicle: { select: { plate: true, brand: true, model: true } } } },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.collectionPayment.count({ where }),
  ])

  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      method: r.method,
      status: r.status,
      paymentDate: r.paymentDate.toISOString(),
      referenceNo: r.referenceNo,
      note: r.note,
      customer: {
        id: r.customer.id,
        type: r.customer.type,
        firstName: r.customer.firstName,
        lastName: r.customer.lastName,
        fullName: r.customer.fullName,
        companyName: r.customer.companyName,
        phone: r.customer.phone,
      },
      serviceOrder: r.serviceOrder
        ? {
            id: r.serviceOrder.id,
            workOrderNo: r.serviceOrder.workOrderNo,
            vehicle: r.serviceOrder.intakeForm.vehicle,
          }
        : null,
    })),
  }
}

export type CustomerBalanceRow = {
  customerId: string
  customer: {
    id: string
    type: string
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    phone: string
  }
  ordersCount: number
  grandTotal: number
  paidAmount: number
  remainingAmount: number
  lastPaymentDate: string | null
  status: "borc_yok" | "alacak_var" | "fazla_odeme" | "tahsilat_bekliyor"
}

export async function getCustomerBalances(workshopId: string): Promise<CustomerBalanceRow[]> {
  const customers = await prisma.customer.findMany({
    where: { workshopId },
    include: {
      intakes: {
        include: {
          order: {
            include: { items: { select: { totalPrice: true, unitPrice: true, quantity: true, type: true } } },
          },
        },
      },
      collections: {
        where: { status: "completed" },
        select: { amount: true, paymentDate: true, serviceOrderId: true },
        orderBy: { paymentDate: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  return customers.map((c) => {
    const orders = c.intakes
      .map((i) => i.order)
      .filter((o): o is NonNullable<typeof o> => o != null && o.status !== "cancelled")

    let grandTotal = 0
    for (const order of orders) {
      const totals = calculateOrderTotalsFromMinimal(order.items, {
        discountAmount: order.discountAmount,
        taxRate: order.taxRate,
      })
      if (totals.hasAnyPrice) grandTotal += totals.grandTotal
    }

    const paidAmount = c.collections.reduce((sum, col) => sum + col.amount, 0)
    const remainingAmount = Math.max(0, grandTotal - paidAmount)
    const lastPaymentDate = c.collections[0]?.paymentDate?.toISOString() || null

    let status: CustomerBalanceRow["status"] = "borc_yok"
    if (paidAmount > grandTotal && grandTotal > 0) status = "fazla_odeme"
    else if (remainingAmount > 0) status = "tahsilat_bekliyor"
    else if (grandTotal > 0 && remainingAmount === 0) status = "alacak_var"

    return {
      customerId: c.id,
      customer: {
        id: c.id,
        type: c.type,
        firstName: c.firstName,
        lastName: c.lastName,
        fullName: c.fullName,
        companyName: c.companyName,
        phone: c.phone,
      },
      ordersCount: orders.length,
      grandTotal,
      paidAmount,
      remainingAmount,
      lastPaymentDate,
      status,
    }
  })
}

export async function getOrderPaymentHistory(workshopId: string, serviceOrderId: string) {
  const collections = await prisma.collectionPayment.findMany({
    where: { workshopId, serviceOrderId, status: "completed" },
    orderBy: { paymentDate: "desc" },
  })

  const totalPaid = collections.reduce((sum, c) => sum + c.amount, 0)

  return {
    collections: collections.map((c) => ({
      id: c.id,
      amount: c.amount,
      method: c.method,
      paymentDate: c.paymentDate.toISOString(),
      referenceNo: c.referenceNo,
      note: c.note,
    })),
    totalPaid,
  }
}
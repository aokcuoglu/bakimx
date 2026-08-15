import { prisma } from "@/lib/db"

export interface GetOrdersParams {
  limit?: number
  offset?: number
  status?: string
  paymentStatus?: string
  workshopId?: string
}

export async function getOrders(params: GetOrdersParams = {}) {
  const { limit = 20, offset = 0, status, paymentStatus, workshopId } = params

  const where: any = {}
  if (status) where.status = status
  if (paymentStatus) where.paymentStatus = paymentStatus
  if (workshopId) where.workshopId = workshopId

  const [orders, total] = await Promise.all([
    prisma.bakimxOrder.findMany({
      where,
      include: {
        workshop: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPriceKurus: true,
            totalPriceKurus: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset
    }),
    prisma.bakimxOrder.count({ where })
  ])

  return { orders, total }
}

export async function getOrderById(id: string) {
  return await prisma.bakimxOrder.findUnique({
    where: { id },
    include: {
      workshop: true,
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } }
        }
      },
      stock_movements: {
        include: {
          product: { select: { name: true, sku: true } }
        },
        orderBy: { createdAt: "desc" }
      },
      photos: true,
      sync_logs: {
        orderBy: { createdAt: "desc" }
      }
    }
  })
}

export async function getOrderStats() {
  const [total, pending, confirmed, shipped, delivered, unpaid, partial, paid] =
    await Promise.all([
      prisma.bakimxOrder.count(),
      prisma.bakimxOrder.count({ where: { status: "pending" } }),
      prisma.bakimxOrder.count({ where: { status: "confirmed" } }),
      prisma.bakimxOrder.count({ where: { status: "shipped" } }),
      prisma.bakimxOrder.count({ where: { status: "delivered" } }),
      prisma.bakimxOrder.count({ where: { paymentStatus: "unpaid" } }),
      prisma.bakimxOrder.count({ where: { paymentStatus: "partial" } }),
      prisma.bakimxOrder.count({ where: { paymentStatus: "paid" } })
    ])

  return {
    total,
    pending,
    confirmed,
    shipped,
    delivered,
    unpaid,
    partialPaid: partial,
    paid
  }
}

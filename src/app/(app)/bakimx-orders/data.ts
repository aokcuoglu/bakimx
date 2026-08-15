import { prisma } from "@/lib/db"
import {
  bakimxOrderTotalKurus,
  type BakimxOrderStatusValue,
} from "@/lib/catalog/bakimx-order"

/**
 * Atölyenin KENDİ BakımX siparişlerinin okuma yolu (BAK-60).
 *
 * TENANT İZOLASYONU: `bakimx_orders` katalog tablolarının aksine tenant'a
 * aittir; buradaki her sorgu `workshopId` ile süzülür ve o parametre daima
 * oturumdan gelir (sayfa `getAppData()` ile okur). Tüm atölyeleri gören tek
 * yüzey `/admin/catalog/orders`.
 */

export interface WorkshopBakimxOrderItemRow {
  id: string
  name: string
  sku: string
  quantity: number
  unitPriceKurus: number
  discountBps: number
}

export interface WorkshopBakimxOrderRow {
  id: string
  status: BakimxOrderStatusValue
  note: string | null
  createdAt: Date
  shippedAt: Date | null
  cancelledAt: Date | null
  items: WorkshopBakimxOrderItemRow[]
  /** KDV hariç toplam, kuruş. */
  totalKurus: number
}

/** Tek sayfada gösterilen üst sınır — sipariş geçmişi büyüse de sayfa açılsın. */
export const WORKSHOP_ORDER_PAGE_SIZE = 100

export async function getWorkshopBakimxOrders(
  workshopId: string,
): Promise<WorkshopBakimxOrderRow[]> {
  const orders = await prisma.bakimxOrder.findMany({
    where: { workshopId },
    orderBy: { createdAt: "desc" },
    take: WORKSHOP_ORDER_PAGE_SIZE,
    select: {
      id: true,
      status: true,
      note: true,
      createdAt: true,
      shippedAt: true,
      cancelledAt: true,
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          nameSnapshot: true,
          skuSnapshot: true,
          quantity: true,
          unitPriceKurus: true,
          discountBps: true,
        },
      },
    },
  })

  return orders.map((order) => {
    const items = order.items.map((item) => ({
      id: item.id,
      // Ad/SKU ürün kartından DEĞİL, kalemden okunur: sipariş o günkü hâlini
      // göstermeli (bkz. schema.prisma → BakimxOrderItem).
      name: item.nameSnapshot,
      sku: item.skuSnapshot,
      quantity: item.quantity,
      unitPriceKurus: item.unitPriceKurus,
      discountBps: item.discountBps,
    }))
    return {
      id: order.id,
      status: order.status as BakimxOrderStatusValue,
      note: order.note,
      createdAt: order.createdAt,
      shippedAt: order.shippedAt,
      cancelledAt: order.cancelledAt,
      items,
      totalKurus: bakimxOrderTotalKurus(items),
    }
  })
}

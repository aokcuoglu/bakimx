import { prisma } from "@/lib/db"
import {
  bakimxOrderStockShortfall,
  bakimxOrderTotalKurus,
  BAKIMX_ORDER_STATUSES,
  type BakimxOrderStatusValue,
} from "@/lib/catalog/bakimx-order"

/**
 * `/admin/catalog/orders` okuma yolu (BAK-60).
 *
 * Admin tarafı olduğu için tenant süzgeci YOKTUR — bütün atölyelerin talepleri
 * tek listede görünür; yetki kapısı çağıran sayfada
 * (`requireAdminCapability("manageCatalog")`).
 *
 * Kalem satırları ürünün GÜNCEL stoğunu da taşır: B akışında rezervasyon yok,
 * dolayısıyla iki atölye aynı 3 adetlik ürünün 3'ünü birden istemiş olabilir.
 * Admin bunu sevkiyattan önce satırdaki uyarıda görmeli.
 */

export type OrderStatusFilter = "all" | BakimxOrderStatusValue

export function parseOrderStatus(value: string | undefined): OrderStatusFilter {
  if (!value || value === "all") return "all"
  return (BAKIMX_ORDER_STATUSES as string[]).includes(value)
    ? (value as BakimxOrderStatusValue)
    : "all"
}

export interface AdminOrderFilters {
  status: OrderStatusFilter
  workshopId: string
}

export interface AdminOrderItemRow {
  id: string
  bakimxProductId: string
  name: string
  sku: string
  quantity: number
  unitPriceKurus: number
  listPriceKurus: number
  discountBps: number
  /** Ürünün ŞU ANKİ stoğu; ürün silinmişse null. */
  stockQty: number | null
  /** Talebin stoğu aştığı adet (0 = sorun yok). */
  shortfall: number
}

export interface AdminOrderRow {
  id: string
  status: BakimxOrderStatusValue
  note: string | null
  workshopId: string
  workshopName: string
  createdAt: Date
  confirmedAt: Date | null
  shippedAt: Date | null
  cancelledAt: Date | null
  items: AdminOrderItemRow[]
  totalKurus: number
  /** Herhangi bir kalemde stok yetersizse liste satırı uyarı gösterir. */
  hasShortfall: boolean
}

export interface AdminOrderWorkshopOption {
  id: string
  name: string
}

/** Tek sayfada gösterilen üst sınır — filtresiz açılışta tüm geçmiş çekilmesin. */
export const ADMIN_ORDER_PAGE_SIZE = 100

export async function getAdminBakimxOrders(
  filters: AdminOrderFilters,
): Promise<{ rows: AdminOrderRow[]; total: number; truncated: boolean }> {
  const where = {
    ...(filters.status === "all" ? {} : { status: filters.status }),
    ...(filters.workshopId ? { workshopId: filters.workshopId } : {}),
  }

  const [total, orders] = await Promise.all([
    prisma.bakimxOrder.count({ where }),
    prisma.bakimxOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: ADMIN_ORDER_PAGE_SIZE,
      select: {
        id: true,
        status: true,
        note: true,
        workshopId: true,
        createdAt: true,
        confirmedAt: true,
        shippedAt: true,
        cancelledAt: true,
        workshop: { select: { name: true } },
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            bakimxProductId: true,
            nameSnapshot: true,
            skuSnapshot: true,
            quantity: true,
            unitPriceKurus: true,
            listPriceKurus: true,
            discountBps: true,
          },
        },
      },
    }),
  ])

  // Güncel stok tek sorguda: kalem başına ürün okumak N+1 üretirdi.
  const productIds = [...new Set(orders.flatMap((o) => o.items.map((i) => i.bakimxProductId)))]
  const products = productIds.length
    ? await prisma.bakimxProduct.findMany({
        where: { id: { in: productIds } },
        select: { id: true, stockQty: true },
      })
    : []
  const stockById = new Map(products.map((p) => [p.id, p.stockQty]))

  const rows = orders.map((order) => {
    const items: AdminOrderItemRow[] = order.items.map((item) => {
      const stockQty = stockById.get(item.bakimxProductId) ?? null
      return {
        id: item.id,
        bakimxProductId: item.bakimxProductId,
        name: item.nameSnapshot,
        sku: item.skuSnapshot,
        quantity: item.quantity,
        unitPriceKurus: item.unitPriceKurus,
        listPriceKurus: item.listPriceKurus,
        discountBps: item.discountBps,
        stockQty,
        shortfall: bakimxOrderStockShortfall({ quantity: item.quantity, stockQty }),
      }
    })
    return {
      id: order.id,
      status: order.status as BakimxOrderStatusValue,
      note: order.note,
      workshopId: order.workshopId,
      workshopName: order.workshop.name,
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      shippedAt: order.shippedAt,
      cancelledAt: order.cancelledAt,
      items,
      totalKurus: bakimxOrderTotalKurus(items),
      hasShortfall: items.some((i) => i.shortfall > 0),
    }
  })

  return { rows, total, truncated: total > rows.length }
}

/** Filtre açılırındaki atölyeler — yalnız sipariş vermiş olanlar listelenir. */
export async function getOrderWorkshopOptions(): Promise<AdminOrderWorkshopOption[]> {
  const grouped = await prisma.bakimxOrder.groupBy({ by: ["workshopId"] })
  if (grouped.length === 0) return []
  const workshops = await prisma.workshop.findMany({
    where: { id: { in: grouped.map((g) => g.workshopId) } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  return workshops
}

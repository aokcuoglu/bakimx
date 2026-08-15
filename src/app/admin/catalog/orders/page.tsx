import { requireAdminCapability } from "@/lib/admin"
import { OrdersList } from "@/app/admin/catalog/orders/orders-list"
import {
  getAdminBakimxOrders,
  getOrderWorkshopOptions,
  parseOrderStatus,
} from "@/app/admin/catalog/orders/data"

export const dynamic = "force-dynamic"

/**
 * BakımX'e gelen sipariş talepleri (BAK-60).
 *
 * Layout guard'ı action'lara miras kalmıyor; sayfa da kendi yetkisini ayrıca
 * ister — `/admin/catalog` ile aynı kalıp.
 */
export default async function AdminCatalogOrdersPage(props: {
  searchParams?: Promise<{ status?: string; workshop?: string }>
}) {
  await requireAdminCapability("manageCatalog")

  const searchParams = await props.searchParams
  const filters = {
    status: parseOrderStatus(searchParams?.status),
    workshopId: searchParams?.workshop ?? "",
  }

  const [{ rows, total, truncated }, workshops] = await Promise.all([
    getAdminBakimxOrders(filters),
    getOrderWorkshopOptions(),
  ])

  return (
    <OrdersList
      rows={rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        confirmedAt: row.confirmedAt?.toISOString() ?? null,
        shippedAt: row.shippedAt?.toISOString() ?? null,
        cancelledAt: row.cancelledAt?.toISOString() ?? null,
      }))}
      total={total}
      truncated={truncated}
      workshops={workshops}
      filters={filters}
    />
  )
}

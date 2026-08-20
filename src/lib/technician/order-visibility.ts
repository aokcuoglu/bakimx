type TechnicianOrderStatus = import("@prisma/client").OrderStatus

const NOT_DELIVERED_CANCELLED: TechnicianOrderStatus[] = ["delivered", "cancelled"]

/**
 * Teknisyen panelindeki liste kapsamı. `technicianId` yalnız yönetici bir
 * teknisyeni özellikle seçtiğinde verilir; saha rollerinde atölyenin tüm işleri
 * listelenir. Tenant filtresi her iki durumda da zorunludur.
 */
export function technicianOrderListWhere(
  workshopId: string,
  technicianId?: string,
  status?: string
) {
  return {
    workshopId,
    ...(technicianId ? { assignedTechnicianId: technicianId } : {}),
    ...(status
      ? { status: status as TechnicianOrderStatus }
      : { status: { notIn: NOT_DELIVERED_CANCELLED } }),
  }
}

/** Doğrudan URL erişiminde de siparişi mutlaka oturumun atölyesine daraltır. */
export function technicianOrderDetailWhere(workshopId: string, orderId: string) {
  return { id: orderId, workshopId }
}

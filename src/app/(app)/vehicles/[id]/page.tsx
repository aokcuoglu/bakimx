import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { VehicleDetail } from "@/components/vehicles/vehicle-detail"
import { calculateOrderTotals, ORDER_TOTALS_ITEM_SELECT } from "@/lib/totals"
import { formatWorkOrderNo } from "@/lib/work-order-number"
import { getVehicleReminders } from "@/lib/reminders/queries"
import { VISIBLE_PHOTO } from "@/lib/intake/photo-visibility"
import { getCrossWorkshopVehicleHistory } from "@/lib/vehicle-history/queries"

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, workshop } = await getAppData()

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, workshopId: user.workshopId },
    include: {
      customer: true,
      intakes: {
        include: {
          order: {
            include: {
              items: { select: { name: true, ...ORDER_TOTALS_ITEM_SELECT } },
            },
          },
          damageMarks: { where: { deletedAt: null } },
          photos: {
            // Dış alım fotoğrafları araç foto geçmişine karışmaz (dahili-yalnız).
            where: { serviceOrderItemId: null, ...VISIBLE_PHOTO },
            select: { id: true, type: true, label: true, fileUrl: true, createdAt: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!vehicle) notFound()

  const reminders = await getVehicleReminders(user.workshopId, id)

  // Aracın BAŞKA servislerdeki geçmişi (BAK-77). Bu atölyenin kendi kaydı
  // olduğu için maske burada zaten açıktır ("own_record"); yine de karar
  // sorgunun kendisine bırakılır, sayfada varsayım yapılmaz.
  const crossWorkshop = await getCrossWorkshopVehicleHistory({
    workshopId: user.workshopId,
    plate: vehicle.plate,
  })

  const serialized = {
    ...vehicle,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
    intakes: vehicle.intakes.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
      approvedAt: i.approvedAt ? i.approvedAt.toISOString() : null,
      // Kalem satırlarını istemciye geçirme: `quantity` Prisma Decimal ve RSC
      // serileştirilemez (BAK-211). Toplam ve parça adları sunucuda hesaplanır.
      order: i.order
        ? {
            id: i.order.id,
            workOrderNo: formatWorkOrderNo(i.order),
            status: i.order.status,
            paymentStatus: i.order.paymentStatus,
            estimatedDeliveryAt: i.order.estimatedDeliveryAt ? i.order.estimatedDeliveryAt.toISOString() : null,
            createdAt: i.order.createdAt.toISOString(),
            changedPartLabels: i.order.items
              .filter((item) => item.type === "part")
              .map((item) => item.name),
            grandTotal: calculateOrderTotals(i.order.items, {
              discountAmount: i.order.discountAmount,
              taxRate: i.order.taxRate,
            }).grandTotal,
          }
        : null,
      damageMarks: i.damageMarks.map((dm) => ({
        ...dm,
        createdAt: dm.createdAt.toISOString(),
      })),
      photos: i.photos.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
    })),
    reminders,
  }

  return (
    <AppShell workshopName={workshop?.name} pageTitle={vehicle.plate} showGlobalSearch={false}>
      <VehicleDetail
        vehicle={serialized}
        workshopName={workshop?.name ?? "Bu servis"}
        crossWorkshop={crossWorkshop}
      />
    </AppShell>
  )
}

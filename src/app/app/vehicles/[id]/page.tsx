import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { VehicleDetail } from "@/components/app/vehicle-detail"
import { calculateOrderTotals } from "@/lib/totals"
import { formatWorkOrderNo } from "@/lib/work-order-number"
import { getVehicleReminders } from "@/lib/reminders/queries"

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, workshop } = await getAppData()

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, workshopId: user.workshopId },
    include: {
      customer: true,
      intakes: {
        include: {
          order: { include: { items: true } },
          damageMarks: true,
          photos: {
            select: { id: true, type: true, label: true, fileUrl: true, createdAt: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!vehicle) notFound()

  const reminders = await getVehicleReminders(user.workshopId, id)

  const serialized = {
    ...vehicle,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
    intakes: vehicle.intakes.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
      approvedAt: i.approvedAt ? i.approvedAt.toISOString() : null,
      order: i.order
        ? {
            ...i.order,
            workOrderNo: formatWorkOrderNo(i.order),
            estimatedDeliveryAt: i.order.estimatedDeliveryAt ? i.order.estimatedDeliveryAt.toISOString() : null,
            createdAt: i.order.createdAt.toISOString(),
            updatedAt: i.order.updatedAt.toISOString(),
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
      <VehicleDetail vehicle={serialized} />
    </AppShell>
  )
}

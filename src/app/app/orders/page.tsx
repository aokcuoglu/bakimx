import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ClipboardList } from "lucide-react"
import { ORDER_STATUS } from "@/lib/constants"

export default async function OrdersPage() {
  const { user, workshop } = await getAppData()

  const orders = await prisma.serviceOrder.findMany({
    where: { workshopId: user.workshopId },
    include: {
      intakeForm: { include: { customer: true, vehicle: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <AppShell workshopName={workshop?.name}>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Servis Emirleri</h2>
          <p className="text-muted-foreground">{orders.length} sipariş</p>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ClipboardList className="size-12 mx-auto mb-3 opacity-30" />
            <p>Henüz servis emri yok</p>
            <p className="text-sm mt-1">Araç kabulünden servis emri oluşturabilirsiniz</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => {
              const statusInfo = ORDER_STATUS[order.status as keyof typeof ORDER_STATUS]
              const intake = order.intakeForm
              return (
                <Link
                  key={order.id}
                  href={`/app/intakes/${intake.id}`}
                  className="flex items-center justify-between p-3 bg-card border rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {intake.vehicle.plate} - {intake.customer.firstName} {intake.customer.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.items.length} kalem
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
                    {statusInfo?.label || order.status}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
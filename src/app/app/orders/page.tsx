import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ClipboardList, Wrench } from "lucide-react"
import { ORDER_STATUS } from "@/lib/constants"
import { formatTRY } from "@/lib/format"

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
          <div className="text-center py-16 text-muted-foreground">
            <ClipboardList className="size-14 mx-auto mb-4 opacity-20" />
            <p className="text-base font-medium">Henüz servis emri yok</p>
            <p className="text-sm mt-1">Araç kabulünden servis emri oluşturabilirsiniz</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => {
              const statusInfo = ORDER_STATUS[order.status as keyof typeof ORDER_STATUS]
              const intake = order.intakeForm
              const total = order.items.reduce((sum, item) => {
                if (item.totalPrice) return sum + item.totalPrice
                if (item.unitPrice) return sum + item.unitPrice * item.quantity
                return sum
              }, 0)
              return (
                <Link
                  key={order.id}
                  href={`/app/orders/${order.id}`}
                  className="flex items-center justify-between p-4 bg-card border rounded-xl hover:bg-muted/50 transition-colors active:bg-muted/70 touch-manipulation"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Wrench className="size-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {intake.vehicle.plate} - {intake.customer.firstName} {intake.customer.lastName}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {order.items.length} kalem
                        </span>
                        {total > 0 && (
                          <span className="text-xs font-medium text-muted-foreground">
                            • {formatTRY(total)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap shrink-0 ml-2 ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
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

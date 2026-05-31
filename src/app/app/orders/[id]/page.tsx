import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { OrderDetail } from "@/components/app/order-detail"

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, workshop } = await getAppData()

  const order = await prisma.serviceOrder.findFirst({
    where: { id, workshopId: user.workshopId },
    include: {
      intakeForm: { include: { customer: true, vehicle: true, damageMarks: true, photos: true } },
      items: true,
    },
  })

  if (!order) notFound()

  return (
    <AppShell workshopName={workshop?.name}>
      <OrderDetail order={order} />
    </AppShell>
  )
}
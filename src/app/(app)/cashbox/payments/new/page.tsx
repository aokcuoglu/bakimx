import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { CollectionCreateForm } from "@/components/app/collection-create-form"
import { prisma } from "@/lib/db"

export default async function NewPaymentPage({ searchParams }: { searchParams: Promise<{ customerId?: string; orderId?: string }> }) {
  const { user, workshop } = await getAppData()
  const params = await searchParams

  const customers = await prisma.customer.findMany({
    where: { workshopId: user.workshopId },
    select: {
      id: true,
      type: true,
      firstName: true,
      lastName: true,
      fullName: true,
      companyName: true,
      phone: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  })

  const intakes = await prisma.vehicleIntakeForm.findMany({
    where: { workshopId: user.workshopId },
    include: {
      customer: { select: { id: true } },
      vehicle: { select: { plate: true, brand: true, model: true } },
      order: {
        include: {
          items: { select: { totalPrice: true, unitPrice: true, quantity: true, type: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  const { calculateOrderTotalsFromMinimal } = await import("@/lib/totals")
  const { computeRemainingAmount } = await import("@/lib/cashbox/status")

  const allCollections = await prisma.collectionPayment.findMany({
    where: { workshopId: user.workshopId, status: "completed" },
    select: { serviceOrderId: true, amount: true },
  })

  const paidByOrder = new Map<string, number>()
  for (const c of allCollections) {
    if (c.serviceOrderId) {
      paidByOrder.set(c.serviceOrderId, (paidByOrder.get(c.serviceOrderId) || 0) + c.amount)
    }
  }

  const orders = intakes
    .filter((i) => i.order && i.order.status !== "cancelled")
    .map((i) => {
      const order = i.order!
      const totals = calculateOrderTotalsFromMinimal(order.items, {
        discountAmount: order.discountAmount,
        taxRate: order.taxRate,
      })
      const paid = paidByOrder.get(order.id) || order.paidAmount || 0
      const remaining = computeRemainingAmount(totals.grandTotal, paid)
      return {
        id: order.id,
        workOrderNo: order.workOrderNo,
        status: order.status,
        paymentStatus: order.paymentStatus,
        grandTotal: totals.grandTotal,
        paidAmount: paid,
        remainingAmount: remaining,
        vehicle: {
          plate: i.vehicle.plate,
          brand: i.vehicle.brand,
          model: i.vehicle.model,
        },
        customerId: i.customer.id,
      }
    })

  const filteredOrders = params.customerId
    ? orders.filter((o) => o.customerId === params.customerId)
    : orders

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Yeni Tahsilat" showGlobalSearch={false}>
      <CollectionCreateForm
        customers={customers.map((c) => ({
          id: c.id,
          type: c.type || "individual",
          firstName: c.firstName,
          lastName: c.lastName,
          fullName: c.fullName,
          companyName: c.companyName,
          phone: c.phone,
        }))}
        orders={filteredOrders}
        preselectedCustomerId={params.customerId}
        preselectedOrderId={params.orderId}
      />
    </AppShell>
  )
}
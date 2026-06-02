import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { CustomerDetail } from "@/components/app/customer-detail"

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const showEdit = sp.edit === "1"
  const { user, workshop } = await getAppData()

  const customer = await prisma.customer.findFirst({
    where: { id, workshopId: user.workshopId },
    include: {
      vehicles: { orderBy: { createdAt: "desc" } },
      intakes: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          vehicle: true,
          order: {
            include: {
              items: { select: { totalPrice: true, unitPrice: true, quantity: true } },
            },
          },
        },
      },
    },
  })

  if (!customer) notFound()

  return (
    <AppShell
      workshopName={workshop?.name}
      pageTitle={customer.type === "corporate" ? customer.companyName || "Kurumsal Müşteri" : [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.fullName || "Müşteri"}
    >
      <CustomerDetail
        showEditInitially={showEdit}
        customer={{
          id: customer.id,
          type: customer.type || "individual",
          firstName: customer.firstName,
          lastName: customer.lastName,
          fullName: customer.fullName,
          companyName: customer.companyName,
          contactName: customer.contactName,
          phone: customer.phone,
          phone2: customer.phone2,
          email: customer.email,
          city: customer.city,
          district: customer.district,
          address: customer.address,
          identityNumber: customer.identityNumber,
          taxNumber: customer.taxNumber,
          taxOffice: customer.taxOffice,
          notes: customer.notes,
          tag: customer.tag,
          source: customer.source,
          priceGroup: customer.priceGroup,
          discountRate: customer.discountRate,
          riskNote: customer.riskNote,
          whatsappConsent: customer.whatsappConsent,
          smsConsent: customer.smsConsent,
          emailConsent: customer.emailConsent,
          kvkkApprovedAt: customer.kvkkApprovedAt ? customer.kvkkApprovedAt.toISOString() : null,
          createdAt: customer.createdAt.toISOString(),
          updatedAt: customer.updatedAt.toISOString(),
        }}
        vehicles={customer.vehicles.map((v) => ({
          id: v.id,
          plate: v.plate,
          brand: v.brand,
          model: v.model,
          modelYear: v.modelYear,
          mileage: v.mileage,
          vin: v.vin,
        }))}
        intakes={customer.intakes.map((i) => ({
          id: i.id,
          status: i.status,
          createdAt: i.createdAt.toISOString(),
          customerComplaint: i.customerComplaint,
          vehicle: { id: i.vehicle.id, plate: i.vehicle.plate, brand: i.vehicle.brand, model: i.vehicle.model },
          order: i.order
            ? {
                id: i.order.id,
                workOrderNo: i.order.workOrderNo,
                status: i.order.status,
                paymentStatus: i.order.paymentStatus,
                estimatedDeliveryAt: i.order.estimatedDeliveryAt ? i.order.estimatedDeliveryAt.toISOString() : null,
                grandTotal: i.order.items.reduce(
                  (sum, item) => {
                    if (item.totalPrice != null && item.totalPrice > 0) return sum + item.totalPrice
                    if (item.unitPrice != null && item.unitPrice > 0) return sum + item.unitPrice * item.quantity
                    return sum
                  },
                  0
                ),
              }
            : null,
        }))}
      />
    </AppShell>
  )
}

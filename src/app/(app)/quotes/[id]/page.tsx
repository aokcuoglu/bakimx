import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { QuoteDetail } from "@/components/app/quote-detail"
import { formatQuoteNo } from "@/lib/work-order-number"

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, workshop } = await getAppData()

  const quote = await prisma.quote.findFirst({
    where: { id, workshopId: user.workshopId },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, fullName: true, companyName: true, type: true, phone: true, email: true } },
      vehicle: { select: { id: true, plate: true, brand: true, model: true } },
      items: { orderBy: { createdAt: "asc" } },
      convertedServiceOrder: { select: { id: true, workOrderNo: true } },
    },
  })

  if (!quote) notFound()

  const quoteNo = quote.quoteNo || formatQuoteNo(quote)

  return (
    <AppShell workshopName={workshop?.name} pageTitle={`Teklif Detay - ${quoteNo}`} showGlobalSearch={false}>
      <QuoteDetail
        quote={{
          id: quote.id,
          quoteNo,
          status: quote.status,
          title: quote.title,
          customerRequest: quote.customerRequest,
          internalNote: quote.internalNote,
          validUntil: quote.validUntil ? quote.validUntil.toISOString() : null,
          estimatedPartsTotal: quote.estimatedPartsTotal,
          estimatedLaborTotal: quote.estimatedLaborTotal,
          discountAmount: quote.discountAmount,
          taxRate: quote.taxRate,
          grandTotal: quote.grandTotal,
          createdAt: quote.createdAt.toISOString(),
          customer: {
            id: quote.customer.id,
            firstName: quote.customer.firstName,
            lastName: quote.customer.lastName,
            fullName: quote.customer.fullName,
            companyName: quote.customer.companyName,
            type: quote.customer.type,
            phone: quote.customer.phone,
            email: quote.customer.email,
          },
          vehicle: quote.vehicle
            ? {
                id: quote.vehicle.id,
                plate: quote.vehicle.plate,
                brand: quote.vehicle.brand,
                model: quote.vehicle.model,
              }
            : null,
          items: quote.items.map((item) => ({
            id: item.id,
            type: item.type,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            note: item.note,
          })),
          convertedServiceOrder: quote.convertedServiceOrder
            ? {
                id: quote.convertedServiceOrder.id,
                workOrderNo: quote.convertedServiceOrder.workOrderNo,
              }
            : null,
        }}
      />
    </AppShell>
  )
}

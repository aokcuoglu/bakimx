import { getAppData } from "@/app/app/data"
import { hasFeature, type PlanTier } from "@/lib/plan"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { OrderDetail } from "@/components/app/order-detail"
import { formatWorkOrderNo } from "@/lib/work-order-number"
import { calculateOrderTotals } from "@/lib/totals"
import { computeRemainingAmount } from "@/lib/cashbox/status"
import { getTechnicians } from "@/lib/technician/queries"

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, workshop } = await getAppData()
  const hasAiAdvisor = !!workshop && hasFeature(workshop.planTier as PlanTier, "aiAdvisor")

  const order = await prisma.serviceOrder.findFirst({
    where: { id, workshopId: user.workshopId },
    include: {
      intakeForm: {
        include: {
          customer: true,
          vehicle: true,
          damageMarks: { orderBy: { createdAt: "asc" } },
          photos: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              type: true,
              label: true,
              required: true,
              fileUrl: true,
              fileName: true,
              mimeType: true,
              sizeBytes: true,
            },
          },
          shareLinks: { where: { isActive: true }, take: 1, orderBy: { createdAt: "desc" } },
        },
      },
      items: { orderBy: { createdAt: "asc" } },
      assignedTechnician: { select: { id: true, fullName: true, role: true } },
    },
  })

  if (!order) notFound()

  const totals = calculateOrderTotals(order.items, {
    discountAmount: order.discountAmount,
    taxRate: order.taxRate,
  })

  const collections = await prisma.collectionPayment.findMany({
    where: { serviceOrderId: id, workshopId: user.workshopId, status: { in: ["completed", "cancelled"] } },
    orderBy: { paymentDate: "desc" },
  })

  const totalPaid = collections.filter(c => c.status === "completed").reduce((sum, c) => sum + c.amount, 0)
  const paidAmount = order.paidAmount || totalPaid
  const remainingAmount = computeRemainingAmount(totals.grandTotal, paidAmount)

  const safeOrder = {
    id: order.id,
    workOrderNo: formatWorkOrderNo(order),
    status: order.status,
    paymentStatus: order.paymentStatus,
    technicianName: order.technicianName,
    assignedTechnicianId: order.assignedTechnicianId,
    assignedTechnicianName: order.assignedTechnician?.fullName || null,
    assignedAt: order.assignedAt ? order.assignedAt.toISOString() : null,
    completedAt: order.completedAt ? order.completedAt.toISOString() : null,
    estimatedDeliveryAt: order.estimatedDeliveryAt ? order.estimatedDeliveryAt.toISOString() : null,
    createdAt: order.createdAt.toISOString(),
    notes: order.notes,
    discountAmount: order.discountAmount,
    taxRate: order.taxRate,
    totals: {
      partsTotal: totals.partsTotal,
      laborTotal: totals.laborTotal,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      taxAmount: totals.taxAmount,
      grandTotal: totals.grandTotal,
      hasAnyPrice: totals.hasAnyPrice,
      partsCount: totals.partsCount,
      laborCount: totals.laborCount,
    },
    items: order.items.map((i) => ({
      id: i.id,
      type: i.type,
      name: i.name,
      sku: i.sku,
      unit: i.unit,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
      note: i.note,
    })),
    customer: {
      id: order.intakeForm.customer.id,
      firstName: order.intakeForm.customer.firstName,
      lastName: order.intakeForm.customer.lastName,
      fullName: order.intakeForm.customer.fullName,
      companyName: order.intakeForm.customer.companyName,
      contactName: order.intakeForm.customer.contactName,
      type: order.intakeForm.customer.type,
      phone: order.intakeForm.customer.phone,
      email: order.intakeForm.customer.email,
    },
    vehicle: {
      plate: order.intakeForm.vehicle.plate,
      brand: order.intakeForm.vehicle.brand,
      model: order.intakeForm.vehicle.model,
      modelYear: order.intakeForm.vehicle.modelYear,
      mileage: order.intakeForm.vehicle.mileage,
      vin: order.intakeForm.vehicle.vin,
    },
    intake: {
      id: order.intakeForm.id,
      status: order.intakeForm.status,
      mileageAtIntake: order.intakeForm.mileageAtIntake,
      customerComplaint: order.intakeForm.customerComplaint,
      internalNote: order.intakeForm.internalNote,
      createdAt: order.intakeForm.createdAt.toISOString(),
      approvedAt: order.intakeForm.approvedAt ? order.intakeForm.approvedAt.toISOString() : null,
      shareToken: order.intakeForm.shareLinks[0]?.token || null,
    },
    damageMarks: order.intakeForm.damageMarks.map((d) => ({
      id: d.id,
      zone: d.zone,
      damageType: d.damageType,
      severity: d.severity,
      note: d.note,
    })),
    photos: order.intakeForm.photos,
    paidAmount,
    remainingAmount,
    collectionHistory: collections.map((c) => ({
      id: c.id,
      amount: c.amount,
      method: c.method,
      status: c.status,
      paymentDate: c.paymentDate.toISOString(),
      referenceNo: c.referenceNo,
      note: c.note,
      cancellationReason: c.cancellationReason,
    })),
  }

  const technicians = await getTechnicians(user.workshopId)

  return (
    <AppShell
      workshopName={workshop?.name}
      pageTitle={`İş Emri ${safeOrder.workOrderNo}`}
    >
      <OrderDetail order={safeOrder} technicians={technicians.map((t) => ({ id: t.id, fullName: t.fullName, role: t.role }))} hasAiAdvisor={hasAiAdvisor} />
    </AppShell>
  )
}
import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { TechnicianOrderDetail } from "@/components/app/technician-order-detail"
import { formatWorkOrderNo } from "@/lib/work-order-number"
import { calculateOrderTotals } from "@/lib/totals"
import { computeRemainingAmount } from "@/lib/cashbox/status"

export const dynamic = "force-dynamic"

export default async function TechnicianOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, workshop } = await getAppData()

  const order = await prisma.serviceOrder.findFirst({
    where: {
      id,
      workshopId: user.workshopId,
      assignedTechnicianId: { not: null },
    },
    include: {
      intakeForm: {
        include: {
          customer: true,
          vehicle: true,
          damageMarks: { orderBy: { createdAt: "asc" } },
          photos: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true, type: true, label: true, required: true,
              fileUrl: true, fileName: true, mimeType: true, sizeBytes: true,
              phase: true, serviceOrderId: true, note: true, createdAt: true,
            },
          },
        },
      },
      items: { orderBy: { createdAt: "asc" } },
      assignedTechnician: { select: { id: true, fullName: true, role: true } },
      checklistItems: { orderBy: { sortOrder: "asc" } },
      internalNotes: { orderBy: { createdAt: "desc" } },
      partsRequests: { orderBy: { createdAt: "desc" } },
      laborSessions: { orderBy: { startTime: "desc" } },
    },
  })

  if (!order) notFound()

  const totals = calculateOrderTotals(order.items, {
    discountAmount: order.discountAmount,
    taxRate: order.taxRate,
  })

  const collections = await prisma.collectionPayment.findMany({
    where: { serviceOrderId: id, workshopId: user.workshopId, status: "completed" },
    orderBy: { paymentDate: "desc" },
  })

  const totalPaid = collections.reduce((sum, c) => sum + c.amount, 0)
  const paidAmount = order.paidAmount || totalPaid
  const remainingAmount = computeRemainingAmount(totals.grandTotal, paidAmount)

  const allTechnicians = await prisma.technician.findMany({
    where: { workshopId: user.workshopId, isActive: true },
    orderBy: { fullName: "asc" },
  })

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
      id: order.intakeForm.vehicle.id,
      plate: order.intakeForm.vehicle.plate,
      brand: order.intakeForm.vehicle.brand,
      model: order.intakeForm.vehicle.model,
      modelYear: order.intakeForm.vehicle.modelYear,
      mileage: order.intakeForm.vehicle.mileage,
      vin: order.intakeForm.vehicle.vin,
      color: order.intakeForm.vehicle.color,
      fuelType: order.intakeForm.vehicle.fuelType,
      transmission: order.intakeForm.vehicle.transmission,
    },
    intake: {
      id: order.intakeForm.id,
      status: order.intakeForm.status,
      mileageAtIntake: order.intakeForm.mileageAtIntake,
      customerComplaint: order.intakeForm.customerComplaint,
      internalNote: order.intakeForm.internalNote,
      createdAt: order.intakeForm.createdAt.toISOString(),
    },
    damageMarks: order.intakeForm.damageMarks.map((d) => ({
      id: d.id,
      zone: d.zone,
      damageType: d.damageType,
      severity: d.severity,
      note: d.note,
    })),
    photos: order.intakeForm.photos.map((p) => ({
      id: p.id,
      type: p.type,
      label: p.label,
      fileUrl: p.fileUrl,
      phase: p.phase,
      serviceOrderId: p.serviceOrderId,
      note: p.note,
      createdAt: p.createdAt.toISOString(),
    })),
    checklistItems: order.checklistItems.map((c) => ({
      id: c.id,
      category: c.category,
      description: c.description,
      isCompleted: c.isCompleted,
      completedAt: c.completedAt ? c.completedAt.toISOString() : null,
      note: c.note,
      sortOrder: c.sortOrder,
    })),
    internalNotes: order.internalNotes.map((n) => ({
      id: n.id,
      content: n.content,
      isPinned: n.isPinned,
      createdAt: n.createdAt.toISOString(),
    })),
    partsRequests: order.partsRequests.map((p) => ({
      id: p.id,
      partName: p.partName,
      partSku: p.partSku,
      quantity: p.quantity,
      note: p.note,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    })),
    laborSessions: order.laborSessions.map((l) => ({
      id: l.id,
      startTime: l.startTime.toISOString(),
      endTime: l.endTime ? l.endTime.toISOString() : null,
      durationMinutes: l.durationMinutes,
      note: l.note,
    })),
    paidAmount,
    remainingAmount,
    vehicleId: order.intakeForm.vehicle.id,
  }

  return (
    <AppShell workshopName={workshop?.name} pageTitle={`İş ${safeOrder.workOrderNo}`} showGlobalSearch={false}>
      <TechnicianOrderDetail
        order={safeOrder}
        technicians={allTechnicians.map((t) => ({
          id: t.id,
          fullName: t.fullName,
          role: t.role,
        }))}
      />
    </AppShell>
  )
}
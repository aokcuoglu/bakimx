import { getAppData } from "@/app/(app)/data"
import { type PlanTier } from "@/lib/plan"
import { resolveFeature } from "@/lib/features"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { WorkOrderDetail } from "@/components/app/work-order-detail"
import { formatWorkOrderNo } from "@/lib/work-order-number"
import { calculateOrderTotals } from "@/lib/totals"
import { computeRemainingAmount } from "@/lib/cashbox/status"
import { getAssignableTechnicians } from "@/lib/technician/queries"
import { getOrderActivity } from "@/lib/orders/activity"

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, workshop } = await getAppData()
  const hasAiAdvisor = !!workshop && (await resolveFeature(workshop.id, workshop.planTier as PlanTier, "aiAdvisor"))

  const order = await prisma.serviceOrder.findFirst({
    where: { id, workshopId: user.workshopId },
    include: {
      intakeForm: {
        include: {
          customer: true,
          vehicle: true,
          damageMarks: { orderBy: { createdAt: "asc" } },
          photos: {
            // Dış alım fotoğrafları buradaki genel foto galerisine girmez; parça
            // kaleminin satın-alma modalından (items.photos) erişilir.
            where: { serviceOrderItemId: null },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              type: true,
              phase: true,
              label: true,
              required: true,
              fileUrl: true,
              fileName: true,
              mimeType: true,
              sizeBytes: true,
              storageProvider: true,
              note: true,
            },
          },
          approvals: { orderBy: { createdAt: "desc" }, take: 1 },
          shareLinks: { where: { isActive: true }, take: 1, orderBy: { createdAt: "desc" } },
          timelineEvents: { orderBy: { createdAt: "asc" } },
        },
      },
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          // Dış alım (source=purchase) kalemine bağlı parça-kutusu fotoğrafı + alan teknisyen.
          photos: { select: { id: true } },
          purchasedBy: { select: { fullName: true } },
        },
      },
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

  const intakeForm = order.intakeForm

  // "Sipariş" sekmesindeki iş emri yönetim kartlarının beklediği düz veri.
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
      externalLaborTotal: totals.externalLaborTotal,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      taxAmount: totals.taxAmount,
      grandTotal: totals.grandTotal,
      hasAnyPrice: totals.hasAnyPrice,
      partsCount: totals.partsCount,
      laborCount: totals.laborCount,
      externalLaborCount: totals.externalLaborCount,
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
      brand: i.brand,
      category: i.category,
      categoryId: i.categoryId,
      source: i.source,
      purchasePriceKurus: i.purchasePriceKurus,
      supplierName: i.supplierName,
      supplierId: i.supplierId,
      purchasedAt: i.purchasedAt ? i.purchasedAt.toISOString() : null,
      purchasedByName: i.purchasedBy?.fullName ?? null,
      purchasePhotoId: i.photos[0]?.id ?? null,
    })),
    customer: {
      id: intakeForm.customer.id,
      firstName: intakeForm.customer.firstName,
      lastName: intakeForm.customer.lastName,
      fullName: intakeForm.customer.fullName,
      companyName: intakeForm.customer.companyName,
      contactName: intakeForm.customer.contactName,
      type: intakeForm.customer.type,
      phone: intakeForm.customer.phone,
      email: intakeForm.customer.email,
    },
    vehicle: {
      id: intakeForm.vehicle.id,
      plate: intakeForm.vehicle.plate,
      brand: intakeForm.vehicle.brand,
      model: intakeForm.vehicle.model,
      modelYear: intakeForm.vehicle.modelYear,
      mileage: intakeForm.vehicle.mileage,
      vin: intakeForm.vehicle.vin,
      catalogVehicleTypeId: intakeForm.vehicle.catalogVehicleTypeId,
      // Ruhsat ipuçları — "VIN'den bağla" resolver'ının doğru motor varyantını
      // otomatik seçmesi için gönderilir (yoksa kullanıcı listeden seçer).
      engineDisplacement: intakeForm.vehicle.engineDisplacement,
      enginePower: intakeForm.vehicle.enginePower,
      fuelType: intakeForm.vehicle.fuelType,
      firstRegistrationDate: intakeForm.vehicle.firstRegistrationDate,
    },
    intake: {
      id: intakeForm.id,
      status: intakeForm.status,
      mileageAtIntake: intakeForm.mileageAtIntake,
      customerComplaint: intakeForm.customerComplaint,
      internalNote: intakeForm.internalNote,
      createdAt: intakeForm.createdAt.toISOString(),
      approvedAt: intakeForm.approvedAt ? intakeForm.approvedAt.toISOString() : null,
      shareToken: intakeForm.shareLinks[0]?.token || null,
    },
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

  // Intake tabanlı sekmelerin (Bilgiler/Özet/Fotoğraflar/Hasar/Paylaşım)
  // beklediği iç içe kabul verisi.
  const intakeProp = {
    id: intakeForm.id,
    status: intakeForm.status,
    mileageAtIntake: intakeForm.mileageAtIntake,
    customerComplaint: intakeForm.customerComplaint,
    internalNote: intakeForm.internalNote,
    approvedAt: intakeForm.approvedAt,
    createdAt: intakeForm.createdAt,
    customer: {
      id: intakeForm.customer.id,
      firstName: intakeForm.customer.firstName,
      lastName: intakeForm.customer.lastName,
      fullName: intakeForm.customer.fullName,
      companyName: intakeForm.customer.companyName,
      contactName: intakeForm.customer.contactName,
      type: intakeForm.customer.type,
      phone: intakeForm.customer.phone,
      email: intakeForm.customer.email,
    },
    vehicle: {
      id: intakeForm.vehicle.id,
      plate: intakeForm.vehicle.plate,
      brand: intakeForm.vehicle.brand,
      model: intakeForm.vehicle.model,
      modelYear: intakeForm.vehicle.modelYear,
      mileage: intakeForm.vehicle.mileage,
      vin: intakeForm.vehicle.vin,
    },
    photos: intakeForm.photos,
    damageMarks: intakeForm.damageMarks.map((d) => ({
      id: d.id,
      zone: d.zone,
      damageType: d.damageType,
      severity: d.severity,
      note: d.note,
    })),
    approvals: intakeForm.approvals.map((a) => ({
      id: a.id,
      status: a.status,
      otpCode: a.otpCode,
      createdAt: a.createdAt,
    })),
    shareLinks: intakeForm.shareLinks.map((s) => ({ id: s.id, token: s.token, isActive: s.isActive })),
    timelineEvents: intakeForm.timelineEvents.map((t) => ({
      eventType: t.eventType,
      description: t.description,
      createdAt: t.createdAt,
    })),
    order: {
      id: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      items: order.items.map((i) => ({
        id: i.id,
        type: i.type,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        totalPrice: i.totalPrice,
        note: i.note,
      })),
    },
  }

  const technicians = await getAssignableTechnicians(user.workshopId)

  const activity = await getOrderActivity({
    workshopId: user.workshopId,
    orderId: order.id,
    intakeFormId: intakeForm.id,
  })

  return (
    <AppShell
      wide
      workshopName={workshop?.name}
      pageTitle={`İş Emri ${safeOrder.workOrderNo}`}
    >
      <WorkOrderDetail
        intake={intakeProp}
        order={safeOrder}
        technicians={technicians}
        hasAiAdvisor={hasAiAdvisor}
        activity={activity}
      />
    </AppShell>
  )
}

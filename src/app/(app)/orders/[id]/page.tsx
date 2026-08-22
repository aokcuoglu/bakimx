import { getAppData } from "@/app/(app)/data"
import { roleCan } from "@/lib/roles"
import { type PlanTier } from "@/lib/plan"
import { resolveFeature } from "@/lib/features"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { WorkOrderDetail } from "@/components/orders/work-order-detail"
import { userDisplayName } from "@/lib/format"
import { formatWorkOrderNo } from "@/lib/work-order-number"
import { calculateOrderTotals } from "@/lib/totals"
import { computeRemainingAmount } from "@/lib/cashbox/status"
import { getAssignableTechnicians } from "@/lib/technician/queries"
import { getOrderActivity } from "@/lib/orders/activity"
import { getLaborCatalog } from "@/lib/labor/queries"
import { VISIBLE_PHOTO } from "@/lib/intake/photo-visibility"
import { ACTIVE_CHECKLIST_ITEM } from "@/lib/technician/checklist-visibility"
import { currentWorkOrderCustomer } from "@/lib/orders/current-customer"
import { quantityToNumber } from "@/lib/orders/quantity"

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  // Liste ekranındaki "Düzenle" aksiyonu buraya ?edit=1 ile gelir; sekme
  // değişince URL ?tab=... ile yeniden yazıldığı için parametre kendiliğinden düşer.
  searchParams: Promise<{ edit?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const editInitially = sp.edit === "1"
  const { user, workshop } = await getAppData()
  const hasAiAdvisor = !!workshop && (await resolveFeature(workshop.id, workshop.planTier as PlanTier, "aiAdvisor"))

  const order = await prisma.serviceOrder.findFirst({
    where: { id, workshopId: user.workshopId },
    include: {
      intakeForm: {
        include: {
          customer: true,
          vehicle: { include: { customer: true } },
          damageMarks: { orderBy: { createdAt: "asc" } },
          photos: {
            // Dış alım fotoğrafları buradaki genel foto galerisine girmez; parça
            // kaleminin satın-alma modalından (items.photos) erişilir.
            where: { serviceOrderItemId: null, ...VISIBLE_PHOTO },
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
        },
      },
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          // Dış alım (source=purchase) kalemine bağlı parça-kutusu fotoğrafı + alan teknisyen.
          photos: { where: VISIBLE_PHOTO, select: { id: true } },
          purchasedBy: { select: { fullName: true } },
          externalProcurementItem: { include: { externalProcurementOrder: { select: { id: true, partnerStatus: true, cancellationRequestedAt: true } } } },
        },
      },
      assignedTechnician: { select: { id: true, fullName: true, role: true } },
      partsRequests: {
        orderBy: { createdAt: "desc" },
        include: { requestedBy: { select: { fullName: true } } },
      },
      // Teknisyen sekmesi (salt okunur) — düzenleme teknisyen panelinde kalır.
      // Bu iş emrinden çıkarılan maddeler burada da görünmez.
      checklistItems: { where: ACTIVE_CHECKLIST_ITEM, orderBy: { sortOrder: "asc" } },
      laborSessions: {
        orderBy: { startTime: "desc" },
        include: {
          // BAK-138: "elle düzeltildi · kim" izi. `select` yerine `include`
          // çünkü kaydın diğer alanları da gerekiyor.
          editedByUser: { select: { firstName: true, lastName: true, email: true, username: true } },
        },
      },
      internalNotes: { orderBy: { createdAt: "desc" } },
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
  const currentCustomer = currentWorkOrderCustomer(intakeForm)

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
    invoiceNo: order.invoiceNo,
    invoiceDate: order.invoiceDate ? order.invoiceDate.toISOString() : null,
    arrivalReason: order.arrivalReason,
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
      hasStockLink: i.partId != null,
      quantity: quantityToNumber(i.quantity),
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
      // BAK-53 — satır KDV'ye tabi mi. DTO'da TAŞINMAK ZORUNDA: düzenleyici bu
      // alandan hem kutuyu hem satırın KDV'li/KDV'siz gösterimini kuruyor.
      // Taşınmazsa sunucu değeri yazar ama refresh'te kutu eski hâline döner.
      includeVat: i.includeVat,
      note: i.note,
      brand: i.brand,
      category: i.category,
      categoryId: i.categoryId,
      // Katalogdan seçilmiş kalemlerde dolu → satırda "Parça detayı" (ⓘ) açar.
      tecdocArticleId: i.tecdocArticleId,
      // BakımX kaleminde dolu → satır kimliği katalogdan gelir, düzenlenemez.
      bakimxProductId: i.bakimxProductId,
      getirbakimProductId: i.getirbakimProductId,
      source: i.source,
      purchasePriceKurus: i.purchasePriceKurus,
      supplierName: i.supplierName,
      supplierId: i.supplierId,
      purchasedAt: i.purchasedAt ? i.purchasedAt.toISOString() : null,
      purchasedByName: i.purchasedBy?.fullName ?? null,
      purchasePhotoId: i.photos[0]?.id ?? null,
      completedAt: i.completedAt ? i.completedAt.toISOString() : null,
      externalProcurement: i.externalProcurementItem ? {
        id: i.externalProcurementItem.externalProcurementOrder.id,
        status: i.externalProcurementItem.externalProcurementOrder.partnerStatus,
        cancellationRequestedAt: i.externalProcurementItem.externalProcurementOrder.cancellationRequestedAt?.toISOString() ?? null,
      } : null,
    })),
    partsRequests: order.partsRequests.map((p) => ({
      id: p.id,
      type: p.type,
      partName: p.partName,
      partSku: p.partSku,
      brand: p.brand,
      tecdocArticleId: p.tecdocArticleId,
      quantity: p.quantity,
      note: p.note,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      requestedByName: p.requestedBy?.fullName ?? null,
      convertedAt: p.convertedAt ? p.convertedAt.toISOString() : null,
      cancelledAt: p.cancelledAt ? p.cancelledAt.toISOString() : null,
      cancelReason: p.cancelReason,
      supplierName: p.supplierName,
      estimatedPriceKurus: p.estimatedPriceKurus,
    })),
    checklistItems: order.checklistItems.map((c) => ({
      id: c.id,
      category: c.category,
      description: c.description,
      isCompleted: c.isCompleted,
      isRequired: c.isRequired,
      completedAt: c.completedAt ? c.completedAt.toISOString() : null,
      note: c.note,
    })),
    laborSessions: order.laborSessions.map((l) => ({
      id: l.id,
      startTime: l.startTime.toISOString(),
      endTime: l.endTime ? l.endTime.toISOString() : null,
      durationMinutes: l.durationMinutes,
      note: l.note,
      editedAt: l.editedAt ? l.editedAt.toISOString() : null,
      editedByName: userDisplayName(l.editedByUser),
    })),
    internalNotes: order.internalNotes.map((n) => ({
      id: n.id,
      content: n.content,
      isPinned: n.isPinned,
      createdAt: n.createdAt.toISOString(),
    })),
    customer: {
      id: currentCustomer.id,
      firstName: currentCustomer.firstName,
      lastName: currentCustomer.lastName,
      fullName: currentCustomer.fullName,
      companyName: currentCustomer.companyName,
      contactName: currentCustomer.contactName,
      type: currentCustomer.type,
      phone: currentCustomer.phone,
      email: currentCustomer.email,
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
      fuelLevelAtIntake: intakeForm.fuelLevelAtIntake,
      customerComplaint: intakeForm.customerComplaint,
      internalNote: intakeForm.internalNote,
      droppedOffByName: intakeForm.droppedOffByName,
      droppedOffByPhone: intakeForm.droppedOffByPhone,
      pickedUpByName: intakeForm.pickedUpByName,
      pickedUpByPhone: intakeForm.pickedUpByPhone,
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
    fuelLevelAtIntake: intakeForm.fuelLevelAtIntake,
    customerComplaint: intakeForm.customerComplaint,
    internalNote: intakeForm.internalNote,
    approvedAt: intakeForm.approvedAt,
    createdAt: intakeForm.createdAt,
    customer: {
      id: currentCustomer.id,
      firstName: currentCustomer.firstName,
      lastName: currentCustomer.lastName,
      fullName: currentCustomer.fullName,
      companyName: currentCustomer.companyName,
      contactName: currentCustomer.contactName,
      type: currentCustomer.type,
      phone: currentCustomer.phone,
      email: currentCustomer.email,
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
    order: {
      id: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      items: order.items.map((i) => ({
        id: i.id,
        type: i.type,
        name: i.name,
        quantity: quantityToNumber(i.quantity),
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

  const laborCatalog = await getLaborCatalog(user.workshopId, { activeOnly: true })

  return (
    <AppShell
      workshopName={workshop?.name}
      pageTitle={`İş Emri ${safeOrder.workOrderNo}`}
    >
      <WorkOrderDetail
        intake={intakeProp}
        order={safeOrder}
        technicians={technicians}
        hasAiAdvisor={hasAiAdvisor}
        activity={activity}
        editInitially={editInitially}
        laborCatalog={laborCatalog}
        canReopen={roleCan(user.role, "order.reopen")}
        canEditInfo={roleCan(user.role, "order.edit")}
      />
    </AppShell>
  )
}

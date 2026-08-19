import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { TechnicianOrderDetail } from "@/components/technician/technician-order-detail"
import { userDisplayName } from "@/lib/format"
import { formatWorkOrderNo } from "@/lib/work-order-number"
import { calculateOrderTotals } from "@/lib/totals"
import { computeRemainingAmount } from "@/lib/cashbox/status"
import { VISIBLE_PHOTO } from "@/lib/intake/photo-visibility"
import { ensureChecklistSeeded } from "@/lib/technician/checklist-seed"
import { roleCan } from "@/lib/roles"

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
            where: VISIBLE_PHOTO,
            orderBy: { createdAt: "asc" },
            select: {
              id: true, type: true, label: true, required: true,
              fileUrl: true, fileName: true, mimeType: true, sizeBytes: true,
              phase: true, serviceOrderId: true, serviceOrderItemId: true, note: true, createdAt: true,
            },
          },
        },
      },
      items: { orderBy: { createdAt: "asc" } },
      assignedTechnician: { select: { id: true, fullName: true, role: true } },
      // BİLİNÇLİ olarak `ACTIVE_CHECKLIST_ITEM` ile filtrelenmez: seed kararı
      // silinen maddelerin `templateKey`ine muhtaç ve panel silinenleri "geri
      // al" bölümünde gösteriyor. Ayrım bellekte `deletedAt` ile yapılır.
      checklistItems: { orderBy: { sortOrder: "asc" } },
      internalNotes: { orderBy: { createdAt: "desc" } },
      partsRequests: { orderBy: { createdAt: "desc" } },
      laborSessions: {
        orderBy: { startTime: "desc" },
        include: {
          // BAK-138: "elle düzeltildi · kim" izi. `select` yerine `include`
          // çünkü kaydın diğer alanları da gerekiyor.
          editedByUser: { select: { firstName: true, lastName: true, email: true, username: true } },
        },
      },
    },
  })

  if (!order) notFound()

  // Şablon maddeleri atama anında oluşur. Özellikten önce atanmış (veya şablona
  // sonradan madde eklenmiş) iş emirlerinde liste eksik kalırdı; burada gerçekten
  // eksik varken bir kez tamamlanır, sonraki açılışlarda hiç yazma olmaz.
  // Kontrol listesi kapı olmadığı için (BAK-24) burası artık tek tamamlama
  // noktası; hiçbir durum geçişi buna bağlı değil.
  // Render sırasındaki yazma sayfayı ASLA düşürmemeli: eşzamanlı iki istek
  // unique kısıtına çarpabilir. Başarısızlıkta liste eksik görünür, sayfa
  // yine açılır; sonraki açılışta tamamlama yeniden denenir.
  const checklistItems = await ensureChecklistSeeded(
    prisma,
    user.workshopId,
    order,
    order.checklistItems.map((c) => c.templateKey)
  )
    .then((seeded) =>
      seeded
        ? prisma.checklistItem.findMany({
            where: { serviceOrderId: order.id, workshopId: user.workshopId },
            orderBy: { sortOrder: "asc" },
          })
        : order.checklistItems
    )
    .catch(() => order.checklistItems)

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

  const suppliers = await prisma.supplier.findMany({
    where: { workshopId: user.workshopId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
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
      brand: i.brand,
      unit: i.unit,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
      note: i.note,
      source: i.source,
      tecdocArticleId: i.tecdocArticleId,
      purchasePriceKurus: i.purchasePriceKurus,
      supplierName: i.supplierName,
      purchasedAt: i.purchasedAt ? i.purchasedAt.toISOString() : null,
      completedAt: i.completedAt ? i.completedAt.toISOString() : null,
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
      catalogVehicleTypeId: order.intakeForm.vehicle.catalogVehicleTypeId,
      // Ruhsat ipuçları — parça talebindeki katalog picker'ı (PickerVehicle)
      // doğru motor varyantını gösterebilsin diye taşınır.
      engineDisplacement: order.intakeForm.vehicle.engineDisplacement,
      enginePower: order.intakeForm.vehicle.enginePower,
      firstRegistrationDate: order.intakeForm.vehicle.firstRegistrationDate,
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
      serviceOrderItemId: p.serviceOrderItemId,
      note: p.note,
      createdAt: p.createdAt.toISOString(),
    })),
    // Silinmiş maddeler de gönderilir: panel bunları "Silinen maddeler"
    // bölümünde geri alınabilir gösterir, listeden/sayımdan `deletedAt` ile
    // ayrılır (gates + ChecklistSection).
    checklistItems: checklistItems.map((c) => ({
      id: c.id,
      category: c.category,
      description: c.description,
      isCompleted: c.isCompleted,
      isRequired: c.isRequired,
      completedAt: c.completedAt ? c.completedAt.toISOString() : null,
      note: c.note,
      sortOrder: c.sortOrder,
      deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
    })),
    internalNotes: order.internalNotes.map((n) => ({
      id: n.id,
      content: n.content,
      isPinned: n.isPinned,
      createdAt: n.createdAt.toISOString(),
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
      // Ofis talebi kaleme çevirdiyse usta da görsün: "istediğim parça iş
      // emrine girdi mi?" sorusu bugüne dek yalnız ofis ekranında yanıtlanıyordu.
      convertedAt: p.convertedAt ? p.convertedAt.toISOString() : null,
      // Ofis talebi reddettiyse gerekçesi de sahaya iner: usta beklediği parçanın
      // neden gelmediğini ekranında görsün, ofisi aramak zorunda kalmasın.
      cancelledAt: p.cancelledAt ? p.cancelledAt.toISOString() : null,
      cancelReason: p.cancelReason,
      supplierName: p.supplierName,
      estimatedPriceKurus: p.estimatedPriceKurus,
      createdAt: p.createdAt.toISOString(),
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
        suppliers={suppliers}
        // Dış alım silme kuralının rol ekseni (BAK-83): teslime hazır iş emrinde
        // kaydı yalnız iş emrini düzenleyebilenler kaldırabilir.
        canEditOrder={roleCan(user.role, "order.edit")}
      />
    </AppShell>
  )
}
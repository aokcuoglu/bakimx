import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { calculateOrderTotals } from "@/lib/totals"
import { getVehicleReminders } from "@/lib/reminders/queries"
import { VehiclePassport } from "@/components/app/vehicle-passport"

export const dynamic = "force-dynamic"

export default async function VehiclePassportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, workshop } = await getAppData()

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, workshopId: user.workshopId },
    include: {
      customer: true,
      intakes: {
        include: {
          order: { include: { items: true, assignedTechnician: { select: { id: true, fullName: true } } } },
          damageMarks: true,
          photos: {
            select: { id: true, type: true, label: true, fileUrl: true, phase: true, createdAt: true },
          },
          timelineEvents: {
            select: { eventType: true, description: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          },
          approvals: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!vehicle) notFound()

  const reminders = await getVehicleReminders(user.workshopId, id)

  const tokens = await prisma.vehiclePassportToken.findMany({
    where: { workshopId: user.workshopId, vehicleId: id },
    orderBy: { createdAt: "desc" },
  })

  const serialized = {
    vehicle: {
      id: vehicle.id,
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      vehicleType: vehicle.vehicleType,
      modelYear: vehicle.modelYear,
      mileage: vehicle.mileage,
      vin: vehicle.vin,
      vinConfirmed: vehicle.vinConfirmed,
      color: vehicle.color,
      engineNo: vehicle.engineNo,
      fuelType: vehicle.fuelType,
      transmission: vehicle.transmission,
      notes: vehicle.notes,
      createdAt: vehicle.createdAt.toISOString(),
    },
    customer: {
      id: vehicle.customer.id,
      type: vehicle.customer.type,
      firstName: vehicle.customer.firstName,
      lastName: vehicle.customer.lastName,
      fullName: vehicle.customer.fullName,
      companyName: vehicle.customer.companyName,
      contactName: vehicle.customer.contactName,
      phone: vehicle.customer.phone,
      email: vehicle.customer.email,
      city: vehicle.customer.city,
    },
    intakes: vehicle.intakes.map((i) => ({
      id: i.id,
      status: i.status,
      mileageAtIntake: i.mileageAtIntake,
      customerComplaint: i.customerComplaint,
      internalNote: i.internalNote,
      createdAt: i.createdAt.toISOString(),
      approvedAt: i.approvedAt?.toISOString() ?? null,
      timelineEvents: i.timelineEvents.map((e) => ({
        eventType: e.eventType,
        description: e.description,
        createdAt: e.createdAt.toISOString(),
      })),
      order: i.order
        ? {
            id: i.order.id,
            workOrderNo: i.order.workOrderNo,
            status: i.order.status,
            paymentStatus: i.order.paymentStatus,
            estimatedDeliveryAt: i.order.estimatedDeliveryAt?.toISOString() ?? null,
            assignedTechnicianName: i.order.assignedTechnician?.fullName || i.order.technicianName || null,
            completedAt: i.order.completedAt?.toISOString() ?? null,
            grandTotal: calculateOrderTotals(i.order.items, {
              discountAmount: i.order.discountAmount,
              taxRate: i.order.taxRate,
            }).grandTotal,
            items: i.order.items.map((item) => ({
              type: item.type,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          }
        : null,
      damageMarks: i.damageMarks.map((dm) => ({
        ...dm,
        createdAt: dm.createdAt.toISOString(),
      })),
      photos: i.photos.map((p) => ({
        ...p,
        phase: p.phase ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
    })),
    reminders,
    tokens: tokens.map((t) => ({
      id: t.id,
      token: t.token,
      label: t.label,
      isActive: t.isActive,
      expiresAt: t.expiresAt?.toISOString() ?? null,
      showServiceHistory: t.showServiceHistory,
      showWorkOrders: t.showWorkOrders,
      showDamages: t.showDamages,
      showPhotos: t.showPhotos,
      showReminders: t.showReminders,
      showPaymentStatus: t.showPaymentStatus,
      createdAt: t.createdAt.toISOString(),
    })),
    workshop: {
      name: workshop?.name || "",
      phone: workshop?.phone || "",
      city: workshop?.city || "",
      address: workshop?.address || "",
      logoUrl: workshop?.logoUrl || null,
    },
  }

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Servis Pasaportu" showGlobalSearch={false}>
      <VehiclePassport data={serialized} />
    </AppShell>
  )
}
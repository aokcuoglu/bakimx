import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { PublicVehiclePassportPage } from "@/components/app/public-vehicle-passport"
import { sanitizePassportForPublic } from "@/lib/passport/data-safety"

export const dynamic = "force-dynamic"

export default async function PublicPassportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const passportToken = await prisma.vehiclePassportToken.findUnique({
    where: { token },
    include: {
      vehicle: {
        include: {
          customer: true,
          intakes: {
            include: {
              order: { include: { items: true } },
              damageMarks: true,
              photos: {
                select: { id: true, type: true, label: true, fileUrl: true, phase: true, createdAt: true },
              },
              timelineEvents: {
                select: { eventType: true, description: true, createdAt: true },
                orderBy: { createdAt: "asc" },
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      workshop: { select: { id: true, name: true, phone: true, city: true, address: true, logoUrl: true } },
    },
  })

  if (!passportToken || !passportToken.isActive || (passportToken.expiresAt && passportToken.expiresAt < new Date())) {
    notFound()
  }

  const { vehicle, workshop } = passportToken

  const workshopSettings = await prisma.workshopSettings.findUnique({
    where: { workshopId: passportToken.workshopId },
    select: { publicPortalLogoUrl: true, passportLogoUrl: true, themeColor: true, accentColor: true },
  })

  const reminders = await prisma.maintenanceReminder.findMany({
    where: { vehicleId: vehicle.id, status: { notIn: ["cancelled"] } },
    orderBy: { dueDate: "asc" },
  })

  const visibility = {
    showServiceHistory: passportToken.showServiceHistory,
    showWorkOrders: passportToken.showWorkOrders,
    showDamages: passportToken.showDamages,
    showPhotos: passportToken.showPhotos,
    showReminders: passportToken.showReminders,
    showPaymentStatus: passportToken.showPaymentStatus,
  }

  const intakesRaw = vehicle.intakes.map((i) => ({
    status: i.status,
    mileageAtIntake: i.mileageAtIntake,
    customerComplaint: i.customerComplaint,
    createdAt: i.createdAt,
    timelineEvents: i.timelineEvents.map((e) => ({
      eventType: e.eventType,
      description: e.description,
      createdAt: e.createdAt,
    })),
    order: i.order
      ? {
          workOrderNo: i.order.workOrderNo,
          status: i.order.status,
          paymentStatus: i.order.paymentStatus,
          items: i.order.items.map((item) => ({
            type: item.type,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
          discountAmount: i.order.discountAmount,
          taxRate: i.order.taxRate,
        }
      : null,
  }))

  const safeData = sanitizePassportForPublic(
    {
      vehicle: {
        plate: vehicle.plate,
        brand: vehicle.brand,
        model: vehicle.model,
        modelYear: vehicle.modelYear,
        mileage: vehicle.mileage,
        vin: vehicle.vin,
        vehicleType: vehicle.vehicleType,
        color: vehicle.color,
        fuelType: vehicle.fuelType,
        transmission: vehicle.transmission,
      },
      customer: {
        firstName: vehicle.customer.firstName,
        lastName: vehicle.customer.lastName,
        fullName: vehicle.customer.fullName,
        companyName: vehicle.customer.companyName,
        contactName: vehicle.customer.contactName,
        type: vehicle.customer.type,
        phone: vehicle.customer.phone,
      },
      intakes: intakesRaw,
      damageMarks: vehicle.intakes.flatMap((i) =>
        i.damageMarks.map((dm) => ({
          zone: dm.zone,
          damageType: dm.damageType,
          severity: dm.severity,
          note: dm.note,
          createdAt: dm.createdAt,
        }))
      ),
      photos: vehicle.intakes.flatMap((i) =>
        i.photos.map((p) => ({
          id: p.id,
          type: p.type,
          label: p.label,
          fileUrl: p.fileUrl,
          phase: p.phase,
          createdAt: p.createdAt,
        }))
      ),
      reminders: reminders.map((r) => ({
        title: r.title,
        type: r.type,
        status: r.status,
        dueDate: r.dueDate,
        dueMileage: r.dueMileage,
        lastServiceDate: r.lastServiceDate,
        lastServiceMileage: r.lastServiceMileage,
        customerNote: r.customerNote,
        completedAt: r.completedAt,
      })),
    },
    visibility
  )

  const serializedData = {
    ...safeData,
    serviceHistory: safeData.serviceHistory.map((e) => ({
      ...e,
      createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
    })),
    workOrders: safeData.workOrders.map((wo) => ({
      ...wo,
      createdAt: wo.createdAt instanceof Date ? wo.createdAt.toISOString() : wo.createdAt,
    })),
    damageHistory: safeData.damageHistory.map((dm) => ({
      ...dm,
      createdAt: dm.createdAt instanceof Date ? dm.createdAt.toISOString() : dm.createdAt,
    })),
    photoHistory: safeData.photoHistory.map((p) => ({
      ...p,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    })),
    reminders: safeData.reminders.map((r) => ({
      ...r,
      dueDate: r.dueDate && r.dueDate instanceof Date ? r.dueDate.toISOString() : r.dueDate,
      lastServiceDate: r.lastServiceDate && r.lastServiceDate instanceof Date ? r.lastServiceDate.toISOString() : r.lastServiceDate,
      completedAt: r.completedAt && r.completedAt instanceof Date ? r.completedAt.toISOString() : r.completedAt,
    })),
  }

  const serializedPassportToken = {
    token: passportToken.token,
    label: passportToken.label,
    isActive: passportToken.isActive,
    expiresAt: passportToken.expiresAt?.toISOString() ?? null,
    createdAt: passportToken.createdAt.toISOString(),
    showServiceHistory: passportToken.showServiceHistory,
    showWorkOrders: passportToken.showWorkOrders,
    showDamages: passportToken.showDamages,
    showPhotos: passportToken.showPhotos,
    showReminders: passportToken.showReminders,
    showPaymentStatus: passportToken.showPaymentStatus,
    workshop: {
      name: workshop.name,
      phone: workshop.phone,
      city: workshop.city,
      address: workshop.address,
      logoUrl: workshop.logoUrl,
      branding: workshopSettings ? {
        publicPortalLogoUrl: workshopSettings.publicPortalLogoUrl,
        passportLogoUrl: workshopSettings.passportLogoUrl,
        themeColor: workshopSettings.themeColor,
        accentColor: workshopSettings.accentColor,
      } : null,
    },
  }

  return <PublicVehiclePassportPage data={serializedData} passportToken={serializedPassportToken} />
}
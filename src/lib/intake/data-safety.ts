import { DAMAGE_TYPES, DAMAGE_SEVERITY, VEHICLE_ZONES, PHOTO_TYPES, INTAKE_STATUS, ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants"

export type SafeIntakeData = {
  status: string
  statusLabel: string
  mileageAtIntake: number | null
  customerComplaint: string
  approvedAt: Date | null
  createdAt: Date
  customer: {
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    contactName: string | null
    type: string
    phone: string
  }
  vehicle: {
    plate: string
    brand: string
    model: string
    modelYear: number | null
    mileage: number | null
    vin: string | null
  }
  photos: { id: string; type: string; label: string; fileUrl: string | null; phase: string }[]
  damageMarks: { zone: string; zoneLabel: string; damageType: string; damageTypeLabel: string; severity: string; severityLabel: string; severityColor: string; note: string | null }[]
  approvals: { status: string; approvedAt: Date | null }[]
  order: { status: string; statusLabel: string; paymentStatusLabel: string; items: { type: string; name: string; quantity: number; unitPrice: number | null; totalPrice: number | null }[] } | null
  timeline: { eventType: string; description: string; createdAt: Date }[]
}

const NEVER_PUBLIC_FIELDS = [
  "internalNote",
  "vinOcrRaw",
  "id",
  "workshopId",
  "customerId",
  "vehicleId",
  "otpCode",
  "ipAddress",
  "userAgent",
] as const

export function sanitizeIntakeForPublic(
  intake: {
    status: string
    mileageAtIntake: number | null
    customerComplaint: string
    internalNote?: string | null
    approvedAt: Date | null
    createdAt: Date
    customer: {
      firstName: string | null
      lastName: string | null
      fullName: string | null
      companyName: string | null
      contactName: string | null
      type: string
      phone: string
    }
    vehicle: {
      plate: string
      brand: string
      model: string
      modelYear: number | null
      mileage: number | null
      vin: string | null
    }
    photos: { id: string; type: string; label: string; fileUrl: string | null; phase?: string }[]
    damageMarks: { zone: string; damageType: string; severity: string; note: string | null }[]
    approvals: { status: string; approvedAt: Date | null }[]
    order: {
      status: string
      paymentStatus?: string
      items: { type: string; name: string; quantity: number; unitPrice: number | null; totalPrice: number | null }[]
    } | null
    timelineEvents?: { eventType: string; description: string; createdAt: Date }[]
  },
  visibility: {
    showPhotos?: boolean
    showDamage?: boolean
    showOrderItems?: boolean
    showPaymentStatus?: boolean
    showTimeline?: boolean
  } = {}
): SafeIntakeData {
  void NEVER_PUBLIC_FIELDS

  const statusLabel = INTAKE_STATUS[intake.status as keyof typeof INTAKE_STATUS]?.label || intake.status

  const damageMarks = (visibility.showDamage !== false)
    ? intake.damageMarks.map((dm) => ({
        zone: dm.zone,
        zoneLabel: VEHICLE_ZONES[dm.zone as keyof typeof VEHICLE_ZONES] || dm.zone,
        damageType: dm.damageType,
        damageTypeLabel: DAMAGE_TYPES[dm.damageType as keyof typeof DAMAGE_TYPES]?.label || dm.damageType,
        severity: dm.severity,
        severityLabel: DAMAGE_SEVERITY[dm.severity as keyof typeof DAMAGE_SEVERITY]?.label || dm.severity,
        severityColor: DAMAGE_SEVERITY[dm.severity as keyof typeof DAMAGE_SEVERITY]?.color || "#9CA3AF",
        note: dm.note,
      }))
    : []

  const photos = (visibility.showPhotos !== false)
    ? intake.photos.map((p) => ({
        id: p.id,
        type: p.type,
        label: PHOTO_TYPES[p.type as keyof typeof PHOTO_TYPES]?.label || p.label,
        fileUrl: p.fileUrl,
        phase: p.phase || "intake",
      }))
    : []

  const order = (visibility.showOrderItems !== false && intake.order)
    ? {
        status: intake.order.status,
        statusLabel: ORDER_STATUS[intake.order.status as keyof typeof ORDER_STATUS]?.label || intake.order.status,
        paymentStatusLabel: (visibility.showPaymentStatus && intake.order.paymentStatus)
          ? PAYMENT_STATUS[intake.order.paymentStatus as keyof typeof PAYMENT_STATUS]?.label || intake.order.paymentStatus
          : "",
        items: intake.order.items.map((i) => ({
          type: i.type,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
        })),
      }
    : null

  const timeline = (visibility.showTimeline !== false && intake.timelineEvents)
    ? intake.timelineEvents.map((e) => ({
        eventType: e.eventType,
        description: e.description,
        createdAt: e.createdAt,
      }))
    : []

  return {
    status: intake.status,
    statusLabel,
    mileageAtIntake: intake.mileageAtIntake,
    customerComplaint: intake.customerComplaint,
    approvedAt: intake.approvedAt,
    createdAt: intake.createdAt,
    customer: intake.customer,
    vehicle: intake.vehicle,
    photos,
    damageMarks,
    approvals: intake.approvals,
    order,
    timeline,
  }
}
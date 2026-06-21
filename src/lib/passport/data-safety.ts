import { ORDER_STATUS, PAYMENT_STATUS, DAMAGE_TYPES, DAMAGE_SEVERITY, VEHICLE_ZONES, PHOTO_TYPES, MAINTENANCE_REMINDER_TYPES, MAINTENANCE_REMINDER_STATUS } from "@/lib/constants"
import { escapeHtml } from "@/lib/html-escape"

export type SafePassportVehicle = {
  plate: string
  brand: string
  model: string
  modelYear: number | null
  mileage: number | null
  vin: string | null
  vehicleType: string | null
  color: string | null
  fuelType: string | null
  transmission: string | null
}

export type SafePassportCustomer = {
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  contactName: string | null
  type: string
  phone: string
}

export type SafePassportTimelineEvent = {
  eventType: string
  description: string
  createdAt: Date
}

export type SafePassportWorkOrder = {
  workOrderNo: string | null
  status: string
  statusLabel: string
  paymentStatus: string | null
  paymentStatusLabel: string | null
  customerComplaint: string
  createdAt: Date
  items: { type: string; name: string; quantity: number; unitPrice: number | null; totalPrice: number | null }[]
  grandTotal: number | null
}

export type SafePassportDamageMark = {
  zone: string
  zoneLabel: string
  damageType: string
  damageTypeLabel: string
  severity: string
  severityLabel: string
  severityColor: string
  note: string | null
  createdAt: Date
}

export type SafePassportPhoto = {
  id: string
  type: string
  label: string
  fileUrl: string | null
  phase: string
  createdAt: Date
}

export type SafePassportReminder = {
  title: string
  type: string
  typeLabel: string
  status: string
  statusLabel: string
  dueDate: Date | null
  dueMileage: number | null
  lastServiceDate: Date | null
  lastServiceMileage: number | null
  customerNote: string | null
  completedAt: Date | null
}

export type SafePassportData = {
  vehicle: SafePassportVehicle
  customer: SafePassportCustomer
  serviceHistory: SafePassportTimelineEvent[]
  workOrders: SafePassportWorkOrder[]
  damageHistory: SafePassportDamageMark[]
  photoHistory: SafePassportPhoto[]
  reminders: SafePassportReminder[]
}

export function sanitizePassportForPublic(
  data: {
    vehicle: {
      plate: string
      brand: string
      model: string
      modelYear: number | null
      mileage: number | null
      vin: string | null
      vehicleType: string | null
      color: string | null
      fuelType: string | null
      transmission: string | null
    }
    customer: {
      firstName: string | null
      lastName: string | null
      fullName: string | null
      companyName: string | null
      contactName: string | null
      type: string
      phone: string
    }
    intakes: Array<{
      status: string
      mileageAtIntake: number | null
      customerComplaint: string
      internalNote?: string | null
      createdAt: Date
      timelineEvents?: Array<{ eventType: string; description: string; createdAt: Date }>
      order: {
        workOrderNo: string | null
        status: string
        paymentStatus: string
        items: Array<{ type: string; name: string; quantity: number; unitPrice: number | null; totalPrice: number | null }>
        discountAmount?: number | null
        taxRate?: number | null
      } | null
    }>
    damageMarks: Array<{
      zone: string
      damageType: string
      severity: string
      note: string | null
      createdAt: Date
    }>
    photos: Array<{
      id: string
      type: string
      label: string
      fileUrl: string | null
      phase: string | null
      createdAt: Date
    }>
    reminders: Array<{
      title: string
      type: string
      status: string
      dueDate: Date | null
      dueMileage: number | null
      lastServiceDate: Date | null
      lastServiceMileage: number | null
      customerNote: string | null
      internalNote?: string | null
      completedAt: Date | null
    }>
  },
  visibility: {
    showServiceHistory?: boolean
    showWorkOrders?: boolean
    showDamages?: boolean
    showPhotos?: boolean
    showReminders?: boolean
    showPaymentStatus?: boolean
  } = {}
): SafePassportData {
  const vehicle: SafePassportVehicle = {
    plate: data.vehicle.plate,
    brand: data.vehicle.brand,
    model: data.vehicle.model,
    modelYear: data.vehicle.modelYear,
    mileage: data.vehicle.mileage,
    vin: data.vehicle.vin,
    vehicleType: data.vehicle.vehicleType,
    color: data.vehicle.color,
    fuelType: data.vehicle.fuelType,
    transmission: data.vehicle.transmission,
  }

  const customer: SafePassportCustomer = {
    firstName: data.customer.firstName,
    lastName: data.customer.lastName,
    fullName: data.customer.fullName,
    companyName: data.customer.companyName,
    contactName: data.customer.contactName,
    type: data.customer.type,
    phone: data.customer.phone,
  }

  const serviceHistory: SafePassportTimelineEvent[] = (visibility.showServiceHistory !== false)
    ? data.intakes.flatMap((intake) =>
        (intake.timelineEvents || [])
          .filter((e) => {
            const internalEventTypes = ["internal_note_added", "labor_session_started", "labor_session_stopped"]
            return !internalEventTypes.includes(e.eventType)
          })
          .map((e) => ({
            eventType: e.eventType,
            description: e.description,
            createdAt: e.createdAt,
          }))
      ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : []

  const workOrders: SafePassportWorkOrder[] = (visibility.showWorkOrders !== false)
    ? data.intakes
        .filter((i) => i.order)
        .map((i) => {
          const order = i.order!
          // Monetary amounts (line prices + grand total) are financial data and
          // are only exposed when the share explicitly enables showPaymentStatus.
          const showMoney = visibility.showPaymentStatus === true

          const grandTotal = order.items.reduce((sum, item) => {
            if (item.totalPrice != null && item.totalPrice > 0) return sum + item.totalPrice
            if (item.unitPrice != null && item.unitPrice > 0) return sum + item.unitPrice * item.quantity
            return sum
          }, 0)

          const items = order.items.map((item) => ({
            type: item.type,
            name: item.name,
            quantity: item.quantity,
            unitPrice: showMoney ? item.unitPrice : null,
            totalPrice: showMoney ? item.totalPrice : null,
          }))

          return {
            workOrderNo: order.workOrderNo,
            status: order.status,
            statusLabel: ORDER_STATUS[order.status as keyof typeof ORDER_STATUS]?.label || order.status,
            paymentStatus: (visibility.showPaymentStatus && order.paymentStatus)
              ? order.paymentStatus
              : null,
            paymentStatusLabel: (visibility.showPaymentStatus && order.paymentStatus)
              ? PAYMENT_STATUS[order.paymentStatus as keyof typeof PAYMENT_STATUS]?.label || order.paymentStatus
              : null,
            customerComplaint: i.customerComplaint,
            createdAt: i.createdAt,
            items,
            grandTotal: showMoney && grandTotal > 0 ? grandTotal : null,
          }
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : []

  const damageHistory: SafePassportDamageMark[] = (visibility.showDamages !== false)
    ? data.damageMarks.map((dm) => ({
        zone: dm.zone,
        zoneLabel: VEHICLE_ZONES[dm.zone as keyof typeof VEHICLE_ZONES] || dm.zone,
        damageType: dm.damageType,
        damageTypeLabel: DAMAGE_TYPES[dm.damageType as keyof typeof DAMAGE_TYPES]?.label || dm.damageType,
        severity: dm.severity,
        severityLabel: DAMAGE_SEVERITY[dm.severity as keyof typeof DAMAGE_SEVERITY]?.label || dm.severity,
        severityColor: DAMAGE_SEVERITY[dm.severity as keyof typeof DAMAGE_SEVERITY]?.color || "#9CA3AF",
        note: dm.note,
        createdAt: dm.createdAt,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : []

  const photoHistory: SafePassportPhoto[] = (visibility.showPhotos !== false)
    ? data.photos.map((p) => ({
        id: p.id,
        type: p.type,
        label: PHOTO_TYPES[p.type as keyof typeof PHOTO_TYPES]?.label || p.label,
        fileUrl: p.fileUrl,
        phase: p.phase || "intake",
        createdAt: p.createdAt,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : []

  const reminders: SafePassportReminder[] = (visibility.showReminders !== false)
    ? data.reminders
        .filter((r) => r.status !== "cancelled")
        .filter((r) => !r.internalNote)
        .map((r) => ({
          title: r.title,
          type: r.type,
          typeLabel: MAINTENANCE_REMINDER_TYPES[r.type as keyof typeof MAINTENANCE_REMINDER_TYPES]?.label || r.type,
          status: r.status,
          statusLabel: MAINTENANCE_REMINDER_STATUS[r.status as keyof typeof MAINTENANCE_REMINDER_STATUS]?.label || r.status,
          dueDate: r.dueDate,
          dueMileage: r.dueMileage,
          lastServiceDate: r.lastServiceDate,
          lastServiceMileage: r.lastServiceMileage,
          customerNote: r.customerNote,
          completedAt: r.completedAt,
        }))
      .sort((a, b) => {
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        return 0
      })
    : []

  return {
    vehicle,
    customer,
    serviceHistory,
    workOrders,
    damageHistory,
    photoHistory,
    reminders,
  }
}

const passportOrNull = (v: string | null): string | null => (v == null ? null : escapeHtml(v))

/**
 * Escape human-readable string fields of SafePassportData for safe
 * interpolation into the raw HTML passport/PDF route. Enum keys, colors,
 * numbers and dates are left untouched. Do NOT use for React pages.
 */
export function escapePassportForHtml(data: SafePassportData): SafePassportData {
  return {
    ...data,
    serviceHistory: data.serviceHistory.map((e) => ({ ...e, description: escapeHtml(e.description) })),
    workOrders: data.workOrders.map((wo) => ({
      ...wo,
      workOrderNo: passportOrNull(wo.workOrderNo),
      statusLabel: escapeHtml(wo.statusLabel),
      paymentStatusLabel: passportOrNull(wo.paymentStatusLabel),
      customerComplaint: escapeHtml(wo.customerComplaint),
      items: wo.items.map((i) => ({ ...i, name: escapeHtml(i.name) })),
    })),
    damageHistory: data.damageHistory.map((dm) => ({
      ...dm,
      zoneLabel: escapeHtml(dm.zoneLabel),
      damageTypeLabel: escapeHtml(dm.damageTypeLabel),
      severityLabel: escapeHtml(dm.severityLabel),
      note: passportOrNull(dm.note),
    })),
    photoHistory: data.photoHistory.map((p) => ({ ...p, label: escapeHtml(p.label) })),
    reminders: data.reminders.map((r) => ({
      ...r,
      title: escapeHtml(r.title),
      typeLabel: escapeHtml(r.typeLabel),
      statusLabel: escapeHtml(r.statusLabel),
    })),
  }
}

export function generatePassportWhatsAppText(options: {
  publicLink: string
  workshopName?: string
  plate?: string
  brand?: string
  model?: string
}): string {
  const { publicLink, workshopName, plate, brand, model } = options

  const lines: string[] = []

  if (workshopName) {
    lines.push(`🚗 ${workshopName}`)
  }

  if (plate) {
    const vehicleInfo = [plate]
    if (brand) vehicleInfo.push(brand)
    if (model) vehicleInfo.push(model)
    lines.push(`📋 Araç: ${vehicleInfo.join(" ")}`)
  }

  lines.push("")
  lines.push("Merhaba, aracınızın dijital servis geçmişine aşağıdaki bağlantıdan ulaşabilirsiniz:")
  lines.push(publicLink)
  lines.push("")
  lines.push("Bu link yalnızca sizinle paylaşılmıştır ve güvenlidir.")

  return lines.join("\n")
}
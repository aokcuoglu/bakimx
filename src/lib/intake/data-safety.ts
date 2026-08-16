import { DAMAGE_TYPES, DAMAGE_SEVERITY, VEHICLE_ZONES, PHOTO_TYPES, INTAKE_STATUS, ORDER_STATUS, PAYMENT_STATUS } from "@/lib/constants"
import { escapeHtml } from "@/lib/html-escape"

export type SafeIntakeData = {
  status: string
  statusLabel: string
  mileageAtIntake: number | null
  fuelLevelAtIntake: number | null
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
  /**
   * `discountAmount` (kuruş) ve `taxRate` (bps) müşteri belgesinin kırılımını
   * besler; kalemdeki `includeVat` hangi satırın KDV'ye tabi olduğunu söyler.
   * Üçü de tutar bilgisidir — `showOrderItems` kapalıyken kalemlerle birlikte
   * düşer (bkz. `showMoney`).
   */
  order: {
    status: string
    statusLabel: string
    paymentStatusLabel: string
    discountAmount: number | null
    taxRate: number | null
    items: { type: string; name: string; quantity: number; unitPrice: number | null; totalPrice: number | null; includeVat: boolean | null }[]
  } | null
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
    fuelLevelAtIntake: number | null
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
      discountAmount?: number | null
      taxRate?: number | null
      items: { type: string; name: string; quantity: number; unitPrice: number | null; totalPrice: number | null; includeVat?: boolean | null }[]
    } | null
  },
  visibility: {
    showPhotos?: boolean
    showDamage?: boolean
    showOrderItems?: boolean
    showPaymentStatus?: boolean
  } = {}
): SafeIntakeData {
  void NEVER_PUBLIC_FIELDS

  const statusLabel = INTAKE_STATUS[intake.status as keyof typeof INTAKE_STATUS]?.label || intake.status
  // Kalem tutarları kalemin kendisiyle birlikte gider: `showOrderItems` hem
  // adları/adetleri hem de tutarları yönetir. `showPaymentStatus` yalnızca
  // "Ödendi / Ödenmedi" etiketini açar.
  //
  // Eskiden tutarlar `showPaymentStatus`e bağlıydı; o bayrak `false` varsayılana
  // sahip ve intake paylaşım linki için onu `true` yapan HİÇBİR kod yolu yok
  // (yalnızca araç pasaportu token'ında bir arayüzü var). Sonuç: müşteri
  // çıktısındaki "Tutar" sütunu her zaman "—" basıyordu.
  const showMoney = visibility.showOrderItems !== false

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
        discountAmount: showMoney ? intake.order.discountAmount ?? null : null,
        taxRate: showMoney ? intake.order.taxRate ?? null : null,
        items: intake.order.items.map((i) => ({
          type: i.type,
          name: i.name,
          quantity: i.quantity,
          unitPrice: showMoney ? i.unitPrice : null,
          totalPrice: showMoney ? i.totalPrice : null,
          // Bayrak aynen taşınır: düşerse `isVatLiable` satırı TABİ sayar
          // (null/undefined → tabi) ve müşteri belgesi KDV'siz bir kalemden de
          // KDV alır — ekrandaki iş emriyle tutmaz.
          includeVat: i.includeVat ?? null,
        })),
      }
    : null

  return {
    status: intake.status,
    statusLabel,
    mileageAtIntake: intake.mileageAtIntake,
    fuelLevelAtIntake: intake.fuelLevelAtIntake,
    customerComplaint: intake.customerComplaint,
    approvedAt: intake.approvedAt,
    createdAt: intake.createdAt,
    customer: intake.customer,
    vehicle: intake.vehicle,
    photos,
    damageMarks,
    approvals: intake.approvals,
    order,
  }
}

const orNull = (v: string | null): string | null => (v == null ? null : escapeHtml(v))

/**
 * Escape all human-readable string fields of a SafeIntakeData for safe
 * interpolation into a raw HTML string (the share/PDF routes build HTML by
 * hand). Enum keys, colors, numbers and dates are left untouched because they
 * are used in lookups/styles/conditionals, never as untrusted HTML text.
 *
 * Do NOT use this for the React pages — JSX escapes automatically; double
 * escaping there would render entities like `&amp;` literally.
 */
export function escapeIntakeForHtml(data: SafeIntakeData): SafeIntakeData {
  return {
    ...data,
    statusLabel: escapeHtml(data.statusLabel),
    customerComplaint: escapeHtml(data.customerComplaint),
    customer: {
      ...data.customer,
      firstName: orNull(data.customer.firstName),
      lastName: orNull(data.customer.lastName),
      fullName: orNull(data.customer.fullName),
      companyName: orNull(data.customer.companyName),
      contactName: orNull(data.customer.contactName),
      phone: escapeHtml(data.customer.phone),
    },
    vehicle: {
      ...data.vehicle,
      plate: escapeHtml(data.vehicle.plate),
      brand: escapeHtml(data.vehicle.brand),
      model: escapeHtml(data.vehicle.model),
      vin: orNull(data.vehicle.vin),
    },
    photos: data.photos.map((p) => ({ ...p, label: escapeHtml(p.label) })),
    damageMarks: data.damageMarks.map((dm) => ({
      ...dm,
      zoneLabel: escapeHtml(dm.zoneLabel),
      damageTypeLabel: escapeHtml(dm.damageTypeLabel),
      severityLabel: escapeHtml(dm.severityLabel),
      note: orNull(dm.note),
    })),
    order: data.order
      ? {
          ...data.order,
          statusLabel: escapeHtml(data.order.statusLabel),
          paymentStatusLabel: escapeHtml(data.order.paymentStatusLabel),
          items: data.order.items.map((i) => ({ ...i, name: escapeHtml(i.name) })),
        }
      : null,
  }
}
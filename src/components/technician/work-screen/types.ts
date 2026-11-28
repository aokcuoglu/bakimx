import type { OrderItem } from "@/components/orders/order-management-panel"
import type { TechnicianLaborSessionRow } from "@/components/technician/labor-session-card"

/**
 * Teknisyen DTO'sundaki kalem. `OrderItem` ofis düzenleyicisinin sözleşmesidir
 * ve dış alım alanlarını "opsiyonel" tutar (eski çağrı yerleri hiç göndermiyordu);
 * teknisyen sayfası bunların HEPSİNİ dolduruyor, o yüzden burada zorunluya
 * daraltılır — panelin kendi bileşenleri (dış alım kartı, kalem kontrol listesi,
 * tamamlama kapısı) `undefined` kabul etmiyor.
 */
export type TechnicianOrderItem = OrderItem & {
  tecdocArticleId: number | null
  purchasePriceKurus: number | null
  supplierName: string | null
  purchasedAt: string | null
  createdAt: string
  completedAt: string | null
}

/**
 * Eski parça/işçilik talebi DTO'su. Talep açma akışı söküldü (teknisyen
 * kalemleri kendisi giriyor); alan, geçmiş emirlerdeki kayıtları — ve ofis
 * tarafında henüz karara bağlanmamışları — okuyabilmek için durur.
 */
export type TechnicianPartsRequest = {
  id: string
  /** "part" | "external_labor" — dış işçilik talebinde katalog alanları boştur. */
  type: string
  partName: string
  partSku: string | null
  brand: string | null
  tecdocArticleId: number | null
  quantity: number
  note: string | null
  status: string
  convertedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
}

export type OrderData = {
  id: string
  workOrderNo: string
  status: string
  paymentStatus: string
  technicianName: string | null
  assignedTechnicianId: string | null
  assignedTechnicianName: string | null
  assignedAt: string | null
  completedAt: string | null
  estimatedDeliveryAt: string | null
  createdAt: string
  notes: string | null
  discountAmount: number | null
  taxRate: number | null
  totals: {
    partsTotal: number
    laborTotal: number
    subtotal: number
    discountAmount: number
    taxAmount: number
    grandTotal: number
    hasAnyPrice: boolean
    partsCount: number
    laborCount: number
  }
  // BAK-141 — kalemler artık ofis düzenleyicisine (PartsLaborGrid) de gidiyor,
  // bu yüzden tip onun sözleşmesinden TÜRETİLİR: iki ekranın alan listesi
  // ayrışırsa typecheck söyler, kullanıcı fark etmez.
  items: TechnicianOrderItem[]
  customer: { id: string; firstName: string | null; lastName: string | null; fullName: string | null; companyName: string | null; type: string; phone: string; email: string | null }
  // engineDisplacement/enginePower/firstRegistrationDate: parça kataloğu
  // bileşenlerinin beklediği PickerVehicle alanları (araç varyantı ipuçları).
  vehicle: { id: string; plate: string; brand: string; model: string; modelYear: number | null; mileage: number | null; vin: string | null; color: string | null; fuelType: string | null; transmission: string | null; catalogVehicleTypeId: number | null; engineDisplacement: string | null; enginePower: string | null; firstRegistrationDate: string | null }
  intake: { id: string; status: string; mileageAtIntake: number | null; customerComplaint: string; internalNote: string | null; createdAt: string }
  damageMarks: { id: string; zone: string; damageType: string; severity: string; note: string | null }[]
  photos: { id: string; type: string; label: string; fileUrl: string | null; phase: string; serviceOrderId: string | null; serviceOrderItemId: string | null; note: string | null; createdAt: string }[]
  checklistItems: { id: string; category: string; description: string; isCompleted: boolean; isRequired: boolean; completedAt: string | null; note: string | null; sortOrder: number; deletedAt: string | null }[]
  internalNotes: { id: string; content: string; isPinned: boolean; createdAt: string; authorName: string | null }[]
  partsRequests: TechnicianPartsRequest[]
  laborSessions: TechnicianLaborSessionRow[]
  paidAmount: number
  remainingAmount: number
  vehicleId: string
}

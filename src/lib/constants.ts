export const DAMAGE_TYPES = {
  scratch: { label: "Çizik", color: "#F59E0B" },
  dent: { label: "Göçük", color: "#F97316" },
  broken: { label: "Kırık", color: "#EF4444" },
  cracked: { label: "Çatlak", color: "#DC2626" },
  paint_damage: { label: "Boya hasarı", color: "#A855F7" },
  missing_part: { label: "Eksik parça", color: "#6B7280" },
  other: { label: "Diğer", color: "#9CA3AF" },
} as const

export const DAMAGE_SEVERITY = {
  light: { label: "Hafif", color: "#22C55E" },
  medium: { label: "Orta", color: "#F59E0B" },
  heavy: { label: "Ağır", color: "#EF4444" },
} as const

export const VEHICLE_ZONES = {
  front_bumper: "Ön tampon",
  rear_bumper: "Arka tampon",
  hood: "Kaput",
  trunk: "Bagaj",
  roof: "Tavan",
  windshield: "Ön cam",
  rear_window: "Arka cam",
  left_front_door: "Sol ön kapı",
  left_rear_door: "Sol arka kapı",
  right_front_door: "Sağ ön kapı",
  right_rear_door: "Sağ arka kapı",
  left_front_fender: "Sol ön çamurluk",
  right_front_fender: "Sağ ön çamurluk",
  left_rear_fender: "Sol arka çamurluk",
  right_rear_fender: "Sağ arka çamurluk",
  left_headlight: "Sol far",
  right_headlight: "Sağ far",
  left_taillight: "Sol far (arka)",
  right_taillight: "Sağ far (arka)",
  wheels: "Tekerlekler",
} as const

export const INTAKE_STATUS = {
  draft: { label: "Taslak", color: "bg-gray-100 text-gray-800" },
  waiting_approval: { label: "Onay bekleniyor", color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Onaylandı", color: "bg-green-100 text-green-800" },
  in_progress: { label: "İşlemde", color: "bg-blue-100 text-blue-800" },
  ready_for_delivery: { label: "Teslimat için hazır", color: "bg-purple-100 text-purple-800" },
  delivered: { label: "Teslim edildi", color: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "İptal", color: "bg-red-100 text-red-800" },
} as const

export const ORDER_STATUS = {
  draft: { label: "Taslak", color: "bg-slate-100 text-slate-700 border-slate-200" },
  waiting_approval: { label: "Onay Bekliyor", color: "bg-amber-100 text-amber-800 border-amber-200" },
  approved: { label: "Onaylandı", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  in_progress: { label: "Devam Ediyor", color: "bg-blue-100 text-blue-800 border-blue-200" },
  waiting_parts: { label: "Parça Bekliyor", color: "bg-orange-100 text-orange-800 border-orange-200" },
  ready_for_delivery: { label: "Teslime Hazır", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  delivered: { label: "Teslim Edildi", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  cancelled: { label: "İptal", color: "bg-rose-100 text-rose-800 border-rose-200" },
} as const

export const PAYMENT_STATUS = {
  unpaid: { label: "Ödenmedi", color: "bg-rose-50 text-rose-700 border-rose-200" },
  partial: { label: "Kısmi", color: "bg-amber-50 text-amber-700 border-amber-200" },
  paid: { label: "Ödendi", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  overpaid: { label: "Fazla Ödeme", color: "bg-sky-50 text-sky-700 border-sky-200" },
  cancelled: { label: "İptal", color: "bg-slate-50 text-slate-500 border-slate-200" },
} as const

export const ORDER_STATUS_ORDER: readonly OrderStatusKey[] = [
  "draft",
  "waiting_approval",
  "approved",
  "in_progress",
  "waiting_parts",
  "ready_for_delivery",
  "delivered",
  "cancelled",
]

export type OrderStatusKey = keyof typeof ORDER_STATUS
export type PaymentStatusKey = keyof typeof PAYMENT_STATUS

export const PHOTO_TYPES = {
  front: { label: "Ön", required: true },
  rear: { label: "Arka", required: true },
  left_side: { label: "Sol yan", required: true },
  right_side: { label: "Sağ yan", required: true },
  dashboard_mileage: { label: "Kilometre", required: true },
  registration_front: { label: "Ruhsat ön", required: false },
  registration_back: { label: "Ruhsat arka", required: false },
  vin_area: { label: "VIN alanı", required: false },
  damage_detail: { label: "Hasar detayı", required: false },
  other: { label: "Diğer", required: false },
} as const

export const CUSTOMER_TYPES = {
  individual: { label: "Bireysel", color: "bg-sky-50 text-sky-700 border-sky-200" },
  corporate: { label: "Kurumsal", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
} as const

export type CustomerTypeKey = keyof typeof CUSTOMER_TYPES

export const CUSTOMER_TAGS = {
  standard: { label: "Standart", color: "bg-slate-50 text-slate-600 border-slate-200" },
  vip: { label: "VIP", color: "bg-amber-50 text-amber-700 border-amber-200" },
  risky: { label: "Riskli", color: "bg-rose-50 text-rose-700 border-rose-200" },
  fleet: { label: "Filo", color: "bg-blue-50 text-blue-700 border-blue-200" },
} as const

export type CustomerTagKey = keyof typeof CUSTOMER_TAGS

export const CUSTOMER_SOURCES = {
  referral: { label: "Tavsiye" },
  google: { label: "Google" },
  social_media: { label: "Sosyal Medya" },
  walk_in: { label: "Yoldan Geldi" },
  existing: { label: "Mevcut Müşteri" },
  other: { label: "Diğer" },
} as const

export type CustomerSourceKey = keyof typeof CUSTOMER_SOURCES

export const CUSTOMER_PRICE_GROUPS = {
  standard: { label: "Standart", color: "bg-slate-50 text-slate-600 border-slate-200" },
  discounted: { label: "İndirimli", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  fleet: { label: "Filo", color: "bg-blue-50 text-blue-700 border-blue-200" },
} as const

export type CustomerPriceGroupKey = keyof typeof CUSTOMER_PRICE_GROUPS

export const VEHICLE_TYPES = [
  { value: "", label: "Tüm Tipler" },
  { value: "binek", label: "Binek" },
  { value: "hafif_ticari", label: "Hafif Ticari" },
  { value: "agir_vasita", label: "Ağır Vasıta" },
  { value: "motosiklet", label: "Motosiklet" },
  { value: "diger", label: "Diğer" },
] as const

export const VEHICLE_FUEL_TYPES = [
  { value: "benzin", label: "Benzin" },
  { value: "dizel", label: "Dizel" },
  { value: "lpg", label: "LPG" },
  { value: "hibrit", label: "Hibrit" },
  { value: "elektrik", label: "Elektrik" },
  { value: "diger", label: "Diğer" },
] as const

export const VEHICLE_TRANSMISSIONS = [
  { value: "manuel", label: "Manuel" },
  { value: "otomatik", label: "Otomatik" },
  { value: "yarim_otomatik", label: "Yarı Otomatik" },
] as const

export const QUOTE_STATUS = {
  draft: { label: "Taslak", color: "bg-slate-100 text-slate-700 border-slate-200" },
  sent: { label: "Gönderildi", color: "bg-blue-100 text-blue-800 border-blue-200" },
  accepted: { label: "Kabul Edildi", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  rejected: { label: "Reddedildi", color: "bg-rose-100 text-rose-800 border-rose-200" },
  expired: { label: "Süresi Doldu", color: "bg-orange-100 text-orange-800 border-orange-200" },
  converted: { label: "İş Emrine Çevrildi", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  cancelled: { label: "İptal", color: "bg-slate-100 text-slate-500 border-slate-200" },
} as const

export type QuoteStatusKey = keyof typeof QUOTE_STATUS

export const APPOINTMENT_STATUS = {
  scheduled: { label: "Planlandı", color: "bg-sky-100 text-sky-800 border-sky-200" },
  confirmed: { label: "Onaylandı", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  arrived: { label: "Geldi", color: "bg-blue-100 text-blue-800 border-blue-200" },
  converted: { label: "İş Emrine Çevrildi", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  completed: { label: "Tamamlandı", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  cancelled: { label: "İptal", color: "bg-slate-100 text-slate-500 border-slate-200" },
  no_show: { label: "Gelmedi", color: "bg-rose-100 text-rose-800 border-rose-200" },
} as const

export type AppointmentStatusKey = keyof typeof APPOINTMENT_STATUS

export const REMINDER_STATUS = {
  none: { label: "Yok", color: "bg-slate-50 text-slate-400 border-slate-100" },
  pending: { label: "Bekliyor", color: "bg-amber-50 text-amber-700 border-amber-200" },
  sent: { label: "Gönderildi", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  failed: { label: "Başarısız", color: "bg-rose-50 text-rose-700 border-rose-200" },
} as const

export type ReminderStatusKey = keyof typeof REMINDER_STATUS

export const MAINTENANCE_REMINDER_STATUS = {
  upcoming: { label: "Yaklaşan", color: "bg-sky-100 text-sky-800 border-sky-200" },
  due_soon: { label: "Yaklaşıyor", color: "bg-amber-100 text-amber-800 border-amber-200" },
  overdue: { label: "Gecikmiş", color: "bg-rose-100 text-rose-800 border-rose-200" },
  completed: { label: "Tamamlandı", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  postponed: { label: "Ertelendi", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  cancelled: { label: "İptal", color: "bg-slate-100 text-slate-500 border-slate-200" },
} as const

export type MaintenanceReminderStatusKey = keyof typeof MAINTENANCE_REMINDER_STATUS

export const MAINTENANCE_REMINDER_TYPES = {
  periodic_maintenance: { label: "Periyodik Bakım" },
  oil_change: { label: "Yağ Bakımı" },
  inspection: { label: "Muayene" },
  tire_change: { label: "Lastik Değişimi" },
  brake_check: { label: "Fren Kontrolü" },
  battery_check: { label: "Akü Kontrolü" },
  insurance: { label: "Sigorta" },
  other: { label: "Diğer" },
} as const

export type MaintenanceReminderTypeKey = keyof typeof MAINTENANCE_REMINDER_TYPES

export const MAINTENANCE_CHANNELS = {
  none: { label: "Yok" },
  sms: { label: "SMS" },
  whatsapp: { label: "WhatsApp" },
  phone: { label: "Telefon" },
  email: { label: "E-posta" },
} as const

export type MaintenanceChannelKey = keyof typeof MAINTENANCE_CHANNELS

export const SUPPLIER_STATUS = {
  active: { label: "Aktif", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  passive: { label: "Pasif", color: "bg-slate-100 text-slate-500 border-slate-200" },
} as const

export type SupplierStatusKey = keyof typeof SUPPLIER_STATUS

export const TECHNICIAN_ROLES = {
  usta: { label: "Usta", color: "bg-amber-100 text-amber-800 border-amber-200" },
  teknisyen: { label: "Teknisyen", color: "bg-blue-100 text-blue-800 border-blue-200" },
  servis_danismani: { label: "Servis Danışmanı", color: "bg-purple-100 text-purple-800 border-purple-200" },
  yonetici: { label: "Yönetici", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
} as const

export type TechnicianRoleKey = keyof typeof TECHNICIAN_ROLES

export const CHECKLIST_CATEGORIES = {
  inspection: { label: "Kontrol", color: "bg-sky-100 text-sky-800 border-sky-200" },
  repair: { label: "Onarım", color: "bg-orange-100 text-orange-800 border-orange-200" },
  delivery: { label: "Teslim", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
} as const

export type ChecklistCategoryKey = keyof typeof CHECKLIST_CATEGORIES

export const PARTS_REQUEST_STATUS = {
  requested: { label: "Talep Edildi", color: "bg-amber-100 text-amber-800 border-amber-200" },
  prepared: { label: "Hazırlandı", color: "bg-blue-100 text-blue-800 border-blue-200" },
  delivered: { label: "Teslim Edildi", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
} as const

export type PartsRequestStatusKey = keyof typeof PARTS_REQUEST_STATUS

export const TECHNICIAN_ORDER_STATUSES = {
  waiting: { label: "Bekliyor", color: "bg-slate-100 text-slate-800 border-slate-200", icon: "clock" },
  in_progress: { label: "İşlemde", color: "bg-blue-100 text-blue-800 border-blue-200", icon: "wrench" },
  completed: { label: "Tamamlandı", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: "check-circle" },
} as const

export const REPAIR_PHOTO_PHASES = {
  before_repair: { label: "Onarım Öncesi", color: "bg-rose-100 text-rose-800" },
  during_repair: { label: "Onarım Sırasında", color: "bg-amber-100 text-amber-800" },
  after_repair: { label: "Onarım Sonrası", color: "bg-emerald-100 text-emerald-800" },
} as const

export const COMMUNICATION_TYPES = {
  sms: { label: "SMS", color: "bg-green-100 text-green-800" },
  whatsapp: { label: "WhatsApp", color: "bg-emerald-100 text-emerald-800" },
  email: { label: "E-posta", color: "bg-blue-100 text-blue-800" },
} as const

export type CommunicationTypeKey = keyof typeof COMMUNICATION_TYPES

export const COMMUNICATION_STATUSES = {
  sent: { label: "Gönderildi", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  failed: { label: "Başarısız", color: "bg-rose-50 text-rose-700 border-rose-200" },
  pending: { label: "Bekliyor", color: "bg-amber-50 text-amber-700 border-amber-200" },
} as const

export type CommunicationStatusKey = keyof typeof COMMUNICATION_STATUSES

export const COMMUNICATION_TEMPLATE_LABELS = {
  appointment_created: "Randevu Oluşturuldu",
  appointment_reminder: "Randevu Hatırlatması",
  intake_approval: "Araç Kabul Onayı",
  quote_ready: "Teklif Hazır",
  work_order_completed: "İş Emri Tamamlandı",
  maintenance_reminder: "Bakım Hatırlatması",
  payment_reminder: "Ödeme Hatırlatması",
  vehicle_passport_share: "Araç Pasaportu Paylaşım",
} as const
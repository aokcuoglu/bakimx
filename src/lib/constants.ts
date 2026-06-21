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
  draft: { label: "Taslak", color: "bg-muted text-foreground" },
  waiting_approval: { label: "Onay bekleniyor", color: "bg-warning/10 text-foreground" },
  approved: { label: "Onaylandı", color: "bg-success/10 text-foreground" },
  in_progress: { label: "İşlemde", color: "bg-primary/10 text-foreground" },
  ready_for_delivery: { label: "Teslimat için hazır", color: "bg-primary/10 text-foreground" },
  delivered: { label: "Teslim edildi", color: "bg-success/10 text-foreground" },
  cancelled: { label: "İptal", color: "bg-destructive/10 text-foreground" },
} as const

export const ORDER_STATUS = {
  draft: { label: "Taslak", color: "bg-muted text-foreground border-border" },
  waiting_approval: { label: "Onay Bekliyor", color: "bg-warning/10 text-foreground border-warning/20" },
  approved: { label: "Onaylandı", color: "bg-success/10 text-foreground border-success/20" },
  in_progress: { label: "Devam Ediyor", color: "bg-primary/10 text-foreground border-primary/20" },
  waiting_parts: { label: "Parça Bekliyor", color: "bg-warning/10 text-foreground border-warning/20" },
  ready_for_delivery: { label: "Teslime Hazır", color: "bg-primary/10 text-foreground border-primary/20" },
  delivered: { label: "Teslim Edildi", color: "bg-success/10 text-foreground border-success/20" },
  cancelled: { label: "İptal", color: "bg-destructive/10 text-foreground border-destructive/20" },
} as const

export const PAYMENT_STATUS = {
  unpaid: { label: "Ödenmedi", color: "bg-destructive/10 text-foreground border-destructive/20" },
  partial: { label: "Kısmi", color: "bg-warning/10 text-foreground border-warning/20" },
  paid: { label: "Ödendi", color: "bg-success/10 text-foreground border-success/20" },
  overpaid: { label: "Fazla Ödeme", color: "bg-primary/10 text-foreground border-primary/20" },
  cancelled: { label: "İptal", color: "bg-muted text-foreground border-border" },
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
  individual: { label: "Bireysel", color: "bg-primary/10 text-foreground border-primary/20" },
  corporate: { label: "Kurumsal", color: "bg-secondary text-secondary-foreground border-border" },
} as const

export type CustomerTypeKey = keyof typeof CUSTOMER_TYPES

export const CUSTOMER_TAGS = {
  standard: { label: "Standart", color: "bg-muted text-foreground border-border" },
  vip: { label: "VIP", color: "bg-warning/10 text-foreground border-warning/20" },
  risky: { label: "Riskli", color: "bg-destructive/10 text-foreground border-destructive/20" },
  fleet: { label: "Filo", color: "bg-primary/10 text-foreground border-primary/20" },
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
  standard: { label: "Standart", color: "bg-muted text-foreground border-border" },
  discounted: { label: "İndirimli", color: "bg-success/10 text-foreground border-success/20" },
  fleet: { label: "Filo", color: "bg-primary/10 text-foreground border-primary/20" },
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
  draft: { label: "Taslak", color: "bg-muted text-foreground border-border" },
  sent: { label: "Gönderildi", color: "bg-primary/10 text-foreground border-primary/20" },
  accepted: { label: "Kabul Edildi", color: "bg-success/10 text-foreground border-success/20" },
  rejected: { label: "Reddedildi", color: "bg-destructive/10 text-foreground border-destructive/20" },
  expired: { label: "Süresi Doldu", color: "bg-warning/10 text-foreground border-warning/20" },
  converted: { label: "İş Emrine Çevrildi", color: "bg-primary/10 text-foreground border-primary/20" },
  cancelled: { label: "İptal", color: "bg-muted text-foreground border-border" },
} as const

export type QuoteStatusKey = keyof typeof QUOTE_STATUS

export const APPOINTMENT_STATUS = {
  scheduled: { label: "Planlandı", color: "bg-primary/10 text-foreground border-primary/20" },
  confirmed: { label: "Onaylandı", color: "bg-success/10 text-foreground border-success/20" },
  arrived: { label: "Geldi", color: "bg-primary/10 text-foreground border-primary/20" },
  converted: { label: "İş Emrine Çevrildi", color: "bg-primary/10 text-foreground border-primary/20" },
  completed: { label: "Tamamlandı", color: "bg-success/10 text-foreground border-success/20" },
  cancelled: { label: "İptal", color: "bg-muted text-foreground border-border" },
  no_show: { label: "Gelmedi", color: "bg-destructive/10 text-foreground border-destructive/20" },
} as const

export type AppointmentStatusKey = keyof typeof APPOINTMENT_STATUS

export const REMINDER_STATUS = {
  none: { label: "Yok", color: "bg-muted text-foreground border-border" },
  pending: { label: "Bekliyor", color: "bg-warning/10 text-foreground border-warning/20" },
  sent: { label: "Gönderildi", color: "bg-success/10 text-foreground border-success/20" },
  failed: { label: "Başarısız", color: "bg-destructive/10 text-foreground border-destructive/20" },
} as const

export type ReminderStatusKey = keyof typeof REMINDER_STATUS

export const MAINTENANCE_REMINDER_STATUS = {
  upcoming: { label: "Yaklaşan", color: "bg-primary/10 text-foreground border-primary/20" },
  due_soon: { label: "Yaklaşıyor", color: "bg-warning/10 text-foreground border-warning/20" },
  overdue: { label: "Gecikmiş", color: "bg-destructive/10 text-foreground border-destructive/20" },
  completed: { label: "Tamamlandı", color: "bg-success/10 text-foreground border-success/20" },
  postponed: { label: "Ertelendi", color: "bg-primary/10 text-foreground border-primary/20" },
  cancelled: { label: "İptal", color: "bg-muted text-foreground border-border" },
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
  active: { label: "Aktif", color: "bg-success/10 text-foreground border-success/20" },
  passive: { label: "Pasif", color: "bg-muted text-foreground border-border" },
} as const

export type SupplierStatusKey = keyof typeof SUPPLIER_STATUS

export const TECHNICIAN_ROLES = {
  usta: { label: "Usta", color: "bg-warning/10 text-foreground border-warning/20" },
  teknisyen: { label: "Teknisyen", color: "bg-primary/10 text-foreground border-primary/20" },
  servis_danismani: { label: "Servis Danışmanı", color: "bg-secondary text-secondary-foreground border-border" },
  yonetici: { label: "Yönetici", color: "bg-success/10 text-foreground border-success/20" },
} as const

export type TechnicianRoleKey = keyof typeof TECHNICIAN_ROLES

export const CHECKLIST_CATEGORIES = {
  inspection: { label: "Kontrol", color: "bg-primary/10 text-foreground border-primary/20" },
  repair: { label: "Onarım", color: "bg-warning/10 text-foreground border-warning/20" },
  delivery: { label: "Teslim", color: "bg-success/10 text-foreground border-success/20" },
} as const

export type ChecklistCategoryKey = keyof typeof CHECKLIST_CATEGORIES

export const PARTS_REQUEST_STATUS = {
  requested: { label: "Talep Edildi", color: "bg-warning/10 text-foreground border-warning/20" },
  prepared: { label: "Hazırlandı", color: "bg-primary/10 text-foreground border-primary/20" },
  delivered: { label: "Teslim Edildi", color: "bg-success/10 text-foreground border-success/20" },
} as const

export type PartsRequestStatusKey = keyof typeof PARTS_REQUEST_STATUS

export const TECHNICIAN_ORDER_STATUSES = {
  waiting: { label: "Bekliyor", color: "bg-muted text-foreground border-border", icon: "clock" },
  in_progress: { label: "İşlemde", color: "bg-primary/10 text-foreground border-primary/20", icon: "wrench" },
  completed: { label: "Tamamlandı", color: "bg-success/10 text-foreground border-success/20", icon: "check-circle" },
} as const

export const REPAIR_PHOTO_PHASES = {
  before_repair: { label: "Onarım Öncesi", color: "bg-destructive/10 text-foreground" },
  during_repair: { label: "Onarım Sırasında", color: "bg-warning/10 text-foreground" },
  after_repair: { label: "Onarım Sonrası", color: "bg-success/10 text-foreground" },
} as const

export const COMMUNICATION_TYPES = {
  sms: { label: "SMS", color: "bg-success/10 text-foreground" },
  whatsapp: { label: "WhatsApp", color: "bg-success/10 text-foreground" },
  email: { label: "E-posta", color: "bg-primary/10 text-foreground" },
} as const

export type CommunicationTypeKey = keyof typeof COMMUNICATION_TYPES

export const COMMUNICATION_STATUSES = {
  sent: { label: "Gönderildi", color: "bg-success/10 text-foreground border-success/20" },
  failed: { label: "Başarısız", color: "bg-destructive/10 text-foreground border-destructive/20" },
  pending: { label: "Bekliyor", color: "bg-warning/10 text-foreground border-warning/20" },
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
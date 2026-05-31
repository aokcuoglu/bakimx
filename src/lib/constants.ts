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
  draft: { label: "Taslak", color: "bg-gray-100 text-gray-800" },
  in_progress: { label: "İşlemde", color: "bg-blue-100 text-blue-800" },
  ready_for_delivery: { label: "Teslimat için hazır", color: "bg-purple-100 text-purple-800" },
  delivered: { label: "Teslim edildi", color: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "İptal", color: "bg-red-100 text-red-800" },
} as const

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
/** Kayıt sihirbazında seçilebilir (aktif) sektörler — sırayla listelenir. */
export const REGISTER_SECTOR_IDS = [
  "auto_service",
  "mechanical_service",
  "body_paint",
  "spare_parts",
  "tire_service",
  "auto_electric",
] as const
export type RegisterSectorId = (typeof REGISTER_SECTOR_IDS)[number]

export function isRegisterSectorEnabled(sectorId: string): sectorId is RegisterSectorId {
  return (REGISTER_SECTOR_IDS as readonly string[]).includes(sectorId)
}

export const BUSINESS_FEATURE_IDS = [
  "stock",
  "fleet",
  "insurance",
  "pickup_delivery",
  "virtual_pos",
] as const
export type BusinessFeatureId = (typeof BUSINESS_FEATURE_IDS)[number]

export const TEAM_SIZE_IDS = ["solo", "2_5", "6_10", "11_25", "26_50", "50_plus"] as const
export type TeamSizeId = (typeof TEAM_SIZE_IDS)[number]

export const REGISTER_MODULE_IDS = [
  "customers_vehicles",
  "work_orders",
  "appointments",
  "reports",
  "stock_parts",
  "quotes",
  "cashbox",
  "suppliers",
  "reminders",
  "communications",
  "digital_intake",
  "service_passport",
] as const
export type RegisterModuleId = (typeof REGISTER_MODULE_IDS)[number]

export const SETUP_PREFERENCE_IDS = ["self_service", "data_migration", "call_me"] as const
export type SetupPreferenceId = (typeof SETUP_PREFERENCE_IDS)[number]

export const REGISTER_STEPS = [
  { label: "Sektör Seçimi", description: "İş kolunuzu belirleyin" },
  { label: "İş Detayları", description: "Servisinize özel sorular" },
  { label: "Ekip Büyüklüğü", description: "Çalışan sayınız" },
  { label: "Modül Seçimi", description: "İhtiyacınız olan özellikler" },
  { label: "Hesap Bilgileri", description: "Firma ve iletişim bilgileri" },
] as const

export type RegisterWizardSnapshot = {
  currentStep: number
  sector: RegisterSectorId | ""
  businessFeatureCount: number
  teamSize: TeamSizeId | ""
  moduleCount: number
}

export const BASE_RECOMMENDED_MODULES: RegisterModuleId[] = [
  "customers_vehicles",
  "work_orders",
  "appointments",
  "reports",
  "digital_intake",
]

const FEATURE_RECOMMENDATIONS: Partial<Record<BusinessFeatureId, RegisterModuleId[]>> = {
  stock: ["stock_parts", "suppliers"],
  fleet: ["reminders", "communications"],
  insurance: ["quotes", "service_passport"],
  pickup_delivery: ["appointments", "communications"],
  virtual_pos: ["cashbox"],
}

/**
 * Kayıt yanıtlarından başlangıç önerisi üretir. Bu tercih paketi veya erişim
 * sınırını değiştirmez; yalnız kurulum profilidir ve kullanıcı modül adımında
 * öneriyi özgürce değiştirebilir.
 */
export function recommendedRegisterModules(
  features: readonly BusinessFeatureId[],
): RegisterModuleId[] {
  const selected = new Set<RegisterModuleId>(BASE_RECOMMENDED_MODULES)
  for (const feature of features) {
    for (const moduleId of FEATURE_RECOMMENDATIONS[feature] ?? []) selected.add(moduleId)
  }
  return REGISTER_MODULE_IDS.filter((moduleId) => selected.has(moduleId))
}

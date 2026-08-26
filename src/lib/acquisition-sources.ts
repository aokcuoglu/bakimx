import type { AcquisitionSource } from "@prisma/client"

export const ACQUISITION_SOURCES = ["sales_advisor", "instagram", "website", "google", "referral", "field_visit", "partner", "other", "unknown"] as const satisfies readonly AcquisitionSource[]
export const ACQUISITION_SOURCE_OPTIONS = [
  { value: "sales_advisor", label: "Satış temsilcisi" }, { value: "instagram", label: "Instagram" },
  { value: "website", label: "Web sitesi" }, { value: "google", label: "Google" },
  { value: "referral", label: "Referans" }, { value: "field_visit", label: "Saha ziyareti" },
  { value: "partner", label: "Partner" }, { value: "other", label: "Diğer" }, { value: "unknown", label: "Bilinmiyor" },
] as const
export const ACQUISITION_SOURCE_LABELS = Object.fromEntries(ACQUISITION_SOURCE_OPTIONS.map((o) => [o.value, o.label])) as Record<AcquisitionSource, string>

/**
 * Satış temsilcisi edinim kaynağından bağımsızdır: Instagram, web sitesi veya
 * başka bir kanaldan gelen iş yerine de temsilci atanabilir.
 */
export function normalizeAcquisitionAdvisorId(value: string | null | undefined) {
  return value?.trim() || null
}

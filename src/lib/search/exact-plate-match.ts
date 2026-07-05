import { normalizePlate } from "@/lib/format"
import type { UnifiedResult } from "./unified-results"

export type ExistingVehicleMatch = {
  vehicleId: string
  customerId: string
  label: string
  sublabel: string
}

/**
 * Arama sonuçları (contains araması geniş döner) içinden birebir plaka eşiti
 * aracı seçer. Plaka boşluk/noktalama farkları normalize edilerek karşılaştırılır.
 * Eşleşme yoksa null.
 */
export function findExactPlateMatch(
  results: UnifiedResult[],
  plate: string,
): ExistingVehicleMatch | null {
  const target = normalizePlate(plate)
  if (!target) return null
  for (const r of results) {
    if (r.kind !== "vehicle") continue
    if (normalizePlate(r.plate) === target) {
      return { vehicleId: r.vehicleId, customerId: r.customerId, label: r.label, sublabel: r.sublabel }
    }
  }
  return null
}

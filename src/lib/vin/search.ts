import { isValidVin, normalizeVin } from "./types"

export type PickerSearchMode = "plate" | "customer" | "vin"

/**
 * Picker arama kutusu için mod-duyarlı sorgu çözümü. `null` → arama atlanır.
 * VIN modu yalnız geçerli 17-hane VIN'de (normalize edilerek) arar; kısmi/geçersiz
 * girişte ve müşteri modunda picker-seviyesi arama yapılmaz (gereksiz DB çağrısı yok).
 */
export function searchQueryFor(mode: PickerSearchMode, query: string): string | null {
  const q = query.trim()
  if (!q) return null
  if (mode === "customer") return null
  if (mode === "vin") return isValidVin(q) ? normalizeVin(q) : null
  return q
}

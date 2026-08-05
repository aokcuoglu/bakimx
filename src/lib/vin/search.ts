import { isValidVin, normalizeVin } from "./types"
import type { UnifiedResult } from "@/lib/search/unified-results"

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

/**
 * Listede hangi sonuçlar gösterilir?
 *
 * Varsayılan (plaka) modda araç VE müşteri birlikte görünür — tek kutu ikisini
 * de arasın diye (#152). Uç nokta zaten ikisini de döndürüyordu, daraltma
 * yalnızca UI'daydı. `buildUnifiedResults` sırayı belirler: önce araçlar.
 *
 * VIN modu araca özgü bir sorgudur, müşteri sonucu anlamsız olur; müşteri modu
 * ise bilinçli olarak yalnız müşteri listeler (yeni müşteri oluşturma yolu).
 */
export function visibleResultsFor(
  mode: PickerSearchMode,
  results: UnifiedResult[]
): UnifiedResult[] {
  if (mode === "customer") return results.filter((r) => r.kind === "customer")
  if (mode === "vin") return results.filter((r) => r.kind === "vehicle")
  return results
}

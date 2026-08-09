import { isValidVin, normalizeVin } from "./types"

/**
 * Previous persisted state of the vehicle being updated. Absent on create.
 */
export interface VinConfirmPrevious {
  vin: string | null
  vinConfirmed: boolean
}

/**
 * `vinConfirmed` is DERIVED, never taken from the client (#179).
 *
 * The vehicle form used to carry a manual "Şase numarası ruhsatla teyit edildi"
 * checkbox, while three other write paths (VIN resolver linkage, inline create
 * modal, smart-capture) already set the flag automatically from a valid VIN.
 * The box was therefore both redundant and a way to claim a confirmation the
 * data does not support (ticked box, empty VIN).
 *
 * Rules:
 * - A valid 17-character VIN (ISO 3779) IS the confirmation → true.
 * - Otherwise the flag falls back to the previous state, but ONLY while the VIN
 *   text is unchanged. This preserves the manual "Teyit Et" action on the vehicle
 *   detail page (confirmVehicleVinAction accepts any non-empty VIN, e.g. a short
 *   pre-ISO chassis number) instead of silently un-confirming it on the next edit.
 * - Changing the VIN to something invalid or empty drops the confirmation: the
 *   confirmed value is no longer the value on record.
 */
export function deriveVinConfirmed(vin: string | null | undefined, previous?: VinConfirmPrevious): boolean {
  if (isValidVin(vin)) return true
  if (!previous?.vinConfirmed) return false
  const next = vin ? normalizeVin(vin) : ""
  const before = previous.vin ? normalizeVin(previous.vin) : ""
  return next !== "" && next === before
}

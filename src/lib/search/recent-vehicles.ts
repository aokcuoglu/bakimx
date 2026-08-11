import { buildUnifiedResults, type UnifiedResult, type VehicleLite } from "@/lib/search/unified-results"

/** Kabul ekranındaki "Son araçlar" kısayolunda gösterilecek araç sayısı. */
export const RECENT_VEHICLE_LIMIT = 6

/**
 * Son kabul formlarını (yeniden eskiye sıralı) tekilleştirerek araç id listesine
 * indirger. Aynı araç peş peşe birkaç kez kabul edilmiş olabilir; kısayolda bir
 * kez görünmesi yeter, sıra ilk (en yeni) kaydına göre belirlenir.
 */
export function recentServicedVehicleIds(
  intakes: { vehicleId: string }[],
  limit: number = RECENT_VEHICLE_LIMIT
): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const intake of intakes) {
    if (!intake.vehicleId || seen.has(intake.vehicleId)) continue
    seen.add(intake.vehicleId)
    ids.push(intake.vehicleId)
    if (ids.length >= limit) break
  }
  return ids
}

/**
 * "Son araçlar" listesi: önce son işlem gören araçlar (`servicedIds` sırasında),
 * ardından kalan yeri dolduracak kadar en yeni eklenen araçlar. Hiç kabul kaydı
 * olmayan yeni bir atölyede liste tamamen "en son eklenen"den gelir; aynı araç
 * iki kez girmez.
 */
export function buildRecentVehicleResults(input: {
  servicedIds: string[]
  serviced: VehicleLite[]
  newest: VehicleLite[]
  limit?: number
}): UnifiedResult[] {
  const limit = input.limit ?? RECENT_VEHICLE_LIMIT
  const byId = new Map(input.serviced.map((v) => [v.id, v]))
  const ordered: VehicleLite[] = []
  const seen = new Set<string>()

  for (const id of input.servicedIds) {
    if (ordered.length >= limit) break
    const vehicle = byId.get(id)
    if (!vehicle || seen.has(id)) continue
    seen.add(id)
    ordered.push(vehicle)
  }

  for (const vehicle of input.newest) {
    if (ordered.length >= limit) break
    if (seen.has(vehicle.id)) continue
    seen.add(vehicle.id)
    ordered.push(vehicle)
  }

  return buildUnifiedResults({ customers: [], vehicles: ordered })
}

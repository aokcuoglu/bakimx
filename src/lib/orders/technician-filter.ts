/**
 * İş emri listesindeki "Usta" filtresinin saf mantığı.
 *
 * URL'den gelen `?technician=` değeri üç şeyden biri olabilir:
 *   ""      → filtre yok (tüm emirler)
 *   "none"  → yalnız atanmamış emirler
 *   <id>    → o ustaya atanmış emirler
 *
 * Gelen id client'tan geldiği için asla doğrudan sorguya konmaz: atölyenin
 * kendi usta listesine karşı doğrulanır. Tanınmayan bir id filtreyi tamamen
 * düşürür (sessizce başka bir atölyenin verisine dokunma ihtimali kalmaz —
 * çağıran taraftaki `workshopId` koşuluna ek ikinci savunma hattı).
 */

export const UNASSIGNED_TECHNICIAN = "none"

export type TechnicianFilterWhere =
  | Record<string, never>
  | { assignedTechnicianId: null }
  | { assignedTechnicianId: string }

export type ResolvedTechnicianFilter = {
  /** Normalize edilmiş değer — form/select'e geri verilecek olan. */
  value: string
  /** Prisma `where` parçası; filtre yoksa boş nesne. */
  where: TechnicianFilterWhere
}

export function resolveTechnicianFilter(
  raw: string | null | undefined,
  validTechnicianIds: readonly string[]
): ResolvedTechnicianFilter {
  const value = (raw || "").trim()

  if (!value) return { value: "", where: {} }
  if (value === UNASSIGNED_TECHNICIAN) {
    return { value: UNASSIGNED_TECHNICIAN, where: { assignedTechnicianId: null } }
  }
  if (!validTechnicianIds.includes(value)) return { value: "", where: {} }

  return { value, where: { assignedTechnicianId: value } }
}

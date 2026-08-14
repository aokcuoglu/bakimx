/**
 * Teknisyen panelindeki teknisyen seçiminin saf mantığı.
 *
 * Seçim URL'de `?technician=` olarak taşınır; böylece sunucu, panelin KPI ve
 * iş emri sorgularını seçilen teknisyene göre çalıştırabilir (seçim yalnızca
 * client state'inde kalırsa sayfa hiç filtrelenmez).
 *
 * Gelen id client'tan geldiği için asla doğrudan sorguya konmaz: atölyenin
 * kendi teknisyen listesine karşı doğrulanır. Tanınmayan ya da boş bir id
 * listedeki ilk teknisyene düşer — başka bir atölyenin verisine dokunma
 * ihtimali kalmaz (çağıran taraftaki `workshopId` koşuluna ek ikinci savunma
 * hattı).
 */

export const TECHNICIAN_PARAM = "technician"

export function resolveSelectedTechnicianId(
  raw: string | null | undefined,
  technicianIds: readonly string[]
): string | null {
  if (technicianIds.length === 0) return null

  const value = (raw || "").trim()
  if (value && technicianIds.includes(value)) return value

  return technicianIds[0]
}

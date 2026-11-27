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

import type { UserRole } from "@prisma/client"

export const TECHNICIAN_PARAM = "technician"

/**
 * Yönetici rollerinin personel kaydı da olabilir; bu bağ onların ekip panelinde
 * başka bir teknisyeni seçmesini engellememeli. Saha rolleri ise yalnız kendi
 * personel kaydına sabitlenir.
 */
export function canSelectAnyTechnician(role: UserRole): boolean {
  return role === "owner" || role === "manager"
}

export function resolveSelectedTechnicianId(
  raw: string | null | undefined,
  technicianIds: readonly string[]
): string | null {
  if (technicianIds.length === 0) return null

  const value = (raw || "").trim()
  if (value && technicianIds.includes(value)) return value

  return technicianIds[0]
}

/**
 * Kiosk ana ekranının odak teknisyeni ("İşlerim" kimin işi). Yönetici seçebilir
 * (tanınmayan/boş değer ilk aktif teknisyene düşer); saha rolü yalnız kendi
 * aktif kaydına bağlıdır, `requested` yok sayılır.
 */
export function resolveKioskFocusTechnicianId(input: {
  canSelect: boolean
  requested: string | null | undefined
  ownTechnicianId: string | null
  activeIds: readonly string[]
}): string | null {
  if (input.canSelect) return resolveSelectedTechnicianId(input.requested, input.activeIds)
  const own = input.ownTechnicianId
  return own && input.activeIds.includes(own) ? own : null
}

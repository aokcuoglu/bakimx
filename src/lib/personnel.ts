import type { TechnicianRole, UserRole } from "@prisma/client"

/**
 * Yetki rolü personel unvanının tek doğruluk kaynağıdır. Technician kaydı iş
 * geçmişinin ilişkilerini taşımaya devam eder; bu eşleme iki rol ekseninin
 * tekrar birbirinden kopmasını engeller.
 */
export function technicianRoleForUser(role: UserRole): TechnicianRole {
  switch (role) {
    case "owner":
      return "yonetici"
    case "manager":
      return "servis_danismani"
    case "cirak":
      return "cirak"
    case "usta":
    case "staff":
      return "usta"
  }
}

export function personnelName(firstName: string | null, lastName: string | null, fallback: string) {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim() || fallback
}

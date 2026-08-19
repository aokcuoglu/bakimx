import type { UserRole } from "@prisma/client"

/**
 * Deny-by-default rota kısıtlaması: usta/cirak/staff rolleri YALNIZ aşağıdaki
 * ön eklerden birine erişebilir. (app) altındaki diğer her rota bu roller için
 * /technician'a yönlenir. Yeni bir rota grubu eklendiğinde otomatik olarak
 * kısıtlı gelir — böylece beyaz liste yerine kara liste kullanılsaydı oluşacak
 * sızıntı riski ortadan kalkar.
 *
 * Test: src/lib/technician-route-access.test.ts bu listeyi (app)/ altındaki
 * gerçek dizinlerle karşılaştırır; yeni dizin eklenip liste güncellenmezse
 * kırmızıya düşer.
 */

export const TECHNICIAN_RESTRICTED_ROLES: readonly UserRole[] = ["usta", "cirak", "staff"]

export const TECHNICIAN_ALLOWED_PREFIXES: readonly string[] = [
  "/technician",
  "/account",
]

export function isTechnicianRestrictedRole(role: string | undefined | null): boolean {
  if (!role) return false
  return (TECHNICIAN_RESTRICTED_ROLES as readonly string[]).includes(role)
}

export function isRouteAllowedForTechnician(pathname: string): boolean {
  return TECHNICIAN_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

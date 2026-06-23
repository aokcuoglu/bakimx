import type { UserRole } from "@prisma/client"

/**
 * Pure role constants — safe to import from client components (no prisma/server
 * deps). The server-only RBAC guards live in `@/lib/rbac` and re-export these.
 */

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Sahip",
  manager: "Yönetici",
  staff: "Personel",
}

export const ROLE_RANK: Record<UserRole, number> = {
  owner: 3,
  manager: 2,
  staff: 1,
}

/** All assignable roles, ordered low → high for UI. */
export const ASSIGNABLE_ROLES: UserRole[] = ["staff", "manager", "owner"]

/** Roles an actor of `role` may assign (never above their own rank). */
export function rolesUpTo(role: UserRole): UserRole[] {
  return ASSIGNABLE_ROLES.filter((r) => ROLE_RANK[r] <= ROLE_RANK[role])
}

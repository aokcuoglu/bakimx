import { AuditLogAction } from "@/lib/audit"
import { resolveAdminMembership } from "@/lib/admin-membership"

/**
 * Deliberately fixed operational identity: unlike ADMIN_EMAILS this address is
 * not an authorization source. The active PlatformAdmin row remains the gate.
 */
export const BREAK_GLASS_ADMIN_EMAIL = "breakglass@bakimx.com"

export function isBreakGlassAdminEmail(identifier: string): boolean {
  return identifier.trim().toLowerCase() === BREAK_GLASS_ADMIN_EMAIL
}

export function isAdminAuthenticationAllowed(input: {
  email: string | null | undefined
  authMethod: "password" | "google_sso" | "development" | undefined
  isDevelopment?: boolean
}): boolean {
  if (input.authMethod === "google_sso") return true
  if (input.authMethod === "password" && input.email) {
    return isBreakGlassAdminEmail(input.email)
  }
  return input.authMethod === "development" && input.isDevelopment === true
}

/**
 * Record a successful password login by the emergency account separately from
 * ordinary workshop logins. Audit is best-effort so an audit outage cannot lock
 * operators out during the incident this account exists to recover from.
 */
export async function auditBreakGlassLogin(input: {
  identifier: string
  userId: string
  workshopId: string
}): Promise<void> {
  if (!isBreakGlassAdminEmail(input.identifier)) return

  try {
    const membership = await resolveAdminMembership({
      id: input.userId,
      email: BREAK_GLASS_ADMIN_EMAIL,
    })
    if (!membership) return

    await AuditLogAction(
      input.workshopId,
      input.userId,
      "PlatformAdmin",
      membership.platformAdminId ?? input.userId,
      "platform_admin_break_glass_login"
    )
  } catch (error) {
    console.error(
      "[admin-break-glass] audit failed:",
      error instanceof Error ? error.message : error
    )
  }
}

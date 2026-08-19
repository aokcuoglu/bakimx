import { notFound, redirect } from "next/navigation"
import type { AdminRole } from "@prisma/client"
import { getCurrentUser, type AuthUser } from "@/lib/auth"
import { getSession } from "@/lib/session"
import { can, isAdminSessionRevoked, type AdminCapability } from "@/lib/admin-roles"
import { resolveAdminMembership } from "@/lib/admin-membership"
import { isAdminAuthenticationAllowed } from "@/lib/admin-break-glass"

/**
 * Platform (BakımX personeli) yetkilendirmesi — `/admin` konsolunun kapısı.
 * Kiracı içi rollerle (`UserRole`, `src/lib/roles.ts`) ilgisi yoktur.
 *
 * Üyelik `PlatformAdmin` tablosundadır (BAK-93). Üyelik kararının kendisi
 * `@/lib/admin-membership` içindedir ve Google SSO yolu (`@/lib/admin-sso`) ile
 * PAYLAŞILIR (BAK-114) — `ADMIN_EMAILS` bootstrap'ının iki yoldan yalnız birinde
 * çalışması, boş tabloda `/admin-login`'i açılamaz hâle getirmişti.
 *
 * Rol/yetenek tablosu ve saf yardımcılar `@/lib/admin-roles` içindedir (istemci
 * bileşenleri oradan import eder); buradan yeniden ihraç edilir ki sunucu tarafı
 * tek bir modülle çalışsın.
 */

export {
  ADMIN_ROLES,
  ADMIN_ROLE_LABELS,
  ADMIN_ROLE_DESCRIPTIONS,
  adminCapabilities,
  can,
  isAdminSessionRevoked,
} from "@/lib/admin-roles"
export { getAdminEmails, isAdminEmail } from "@/lib/admin-membership"
export type { AdminRole, AdminCapability }

/**
 * Yönetici her zaman e-postalı bir hesaptır — üyelik `PlatformAdmin.userId`
 * üzerinden kurulsa da giriş kimliği e-postadır. Tip bunu taşır ki
 * `confirmedByEmail` gibi denetim alanları `user.email` nullable olduğu hâlde
 * (BAK-40) ekstra kontrol istemesin.
 */
export type AdminUser = AuthUser & { email: string }

export interface AdminContext {
  user: AdminUser
  adminRole: AdminRole
  /** `PlatformAdmin.id`; yalnız bootstrap yazması başarısız olduysa null. */
  platformAdminId: string | null
}

/** Oturum damgası; istek kapsamı dışında (cron/script/build) undefined. */
async function adminSessionState(): Promise<{
  authenticatedAt: number | undefined
  authMethod: "password" | "google_sso" | "development" | undefined
}> {
  try {
    const session = await getSession()
    return { authenticatedAt: session.authenticatedAt, authMethod: session.authMethod }
  } catch {
    return { authenticatedAt: undefined, authMethod: undefined }
  }
}

interface ResolvedAdmin {
  adminRole: AdminRole
  platformAdminId: string | null
}

/**
 * Etkin kullanıcının platform rolü, ya da yönetici değilse null.
 *
 * Üyelik kararı ortak yardımcıdadır; burada yalnız ŞİFRELİ yola özgü adım kalır:
 * mevcut oturum çerezinin damgası `sessionsValidFrom`'dan eskiyse reddet (BAK-93).
 */
async function resolveAdmin(user: AuthUser): Promise<ResolvedAdmin | null> {
  const session = await adminSessionState()
  if (!isAdminAuthenticationAllowed({
    email: user.email,
    authMethod: session.authMethod,
    isDevelopment: process.env.NODE_ENV === "development",
  })) return null

  const membership = await resolveAdminMembership(user)
  if (!membership) return null
  if (isAdminSessionRevoked(session.authenticatedAt, membership.sessionsValidFrom)) return null
  return { adminRole: membership.adminRole, platformAdminId: membership.platformAdminId }
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false
  return (await resolveAdmin(user)) !== null
}

/**
 * Use in admin pages AND admin server actions. Throws notFound() (404) for
 * non-admins so the console's existence isn't revealed. Returns the admin user.
 */
export async function requireAdmin(): Promise<AdminUser> {
  return (await getAdminContext()).user
}

export async function getAdminContext(): Promise<AdminContext> {
  const user = await getCurrentUser()
  if (!user) redirect("/login")

  const resolved = await resolveAdmin(user)
  // `resolveAdmin` e-postasız kullanıcıya zaten null döner; ikinci kontrol
  // yalnız `AdminUser.email` daraltması için.
  if (!resolved || !user.email) notFound()

  return {
    user: { ...user, email: user.email },
    adminRole: resolved.adminRole,
    platformAdminId: resolved.platformAdminId,
  }
}

/**
 * Gate an admin page/action on a specific capability. 404s (like requireAdmin)
 * when the capability is denied, so the console's surface isn't revealed.
 */
export async function requireAdminCapability(capability: AdminCapability): Promise<AdminContext> {
  const ctx = await getAdminContext()
  if (!can(ctx, capability)) notFound()
  return ctx
}

import { notFound, redirect } from "next/navigation"
import type { AdminRole } from "@prisma/client"
import { getCurrentUser, type AuthUser } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"
import { can, isAdminSessionRevoked, type AdminCapability } from "@/lib/admin-roles"

/**
 * Platform (BakımX personeli) yetkilendirmesi — `/admin` konsolunun kapısı.
 * Kiracı içi rollerle (`UserRole`, `src/lib/roles.ts`) ilgisi yoktur.
 *
 * Üyelik `PlatformAdmin` tablosundadır (BAK-93). `ADMIN_EMAILS` env değişkeni
 * YALNIZ bootstrap yoludur: tablo boşken devreye girer ve ilk yönetici okumasında
 * satırları kendisi yazar. Tablo dolduğu andan itibaren tek kaynak DB'dir — env'de
 * adı geçen ama tabloda satırı olmayan biri yönetici DEĞİLDİR.
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
export type { AdminRole, AdminCapability }

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getAdminEmails().includes(email.trim().toLowerCase())
}

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
  /** `PlatformAdmin.id`, ya da env bootstrap'ıyla girilmişse null. */
  platformAdminId: string | null
}

/** Oturum damgası; istek kapsamı dışında (cron/script/build) undefined. */
async function sessionAuthenticatedAt(): Promise<number | undefined> {
  try {
    const session = await getSession()
    return session.authenticatedAt
  } catch {
    return undefined
  }
}

/**
 * Env allowlist'i tabloya taşır (tek seferlik, idempotent). `skipDuplicates`
 * eşzamanlı iki isteğin yarışını zararsız kılar. Best-effort: yazma hatası
 * konsola giriş yapılmasını ENGELLEMEZ (çağıran yakalar) — aksi hâlde geçici bir
 * yazma sorunu kurucuyu kendi konsolundan kilitlerdi.
 */
async function materializeEnvAdmins(): Promise<void> {
  const emails = getAdminEmails()
  if (emails.length === 0) return

  const users = await prisma.user.findMany({
    where: { email: { in: emails, mode: "insensitive" } },
    select: { id: true },
  })
  if (users.length === 0) return

  await prisma.platformAdmin.createMany({
    data: users.map((u) => ({ userId: u.id, role: "founder" as const })),
    skipDuplicates: true,
  })
}

/**
 * Tablo boşken bootstrap'ı tetikleyip verilen userId için oluşan satırı döner.
 * Tablo doluysa veya e-posta `ADMIN_EMAILS`'te değilse null döner.
 *
 * HER İKİ giriş yolu (şifreli + SSO) bu tek noktadan geçer. Bootstrap kararını
 * birden fazla yere yazmak, BAK-114'ün kök nedeniydi.
 */
export async function bootstrapAdminIfEmpty(
  userId: string,
  email: string
): Promise<{ id: string; role: AdminRole } | null> {
  if (!isAdminEmail(email)) return null
  if ((await prisma.platformAdmin.count()) > 0) return null

  try {
    await materializeEnvAdmins()
  } catch (err) {
    console.error("[admin] env bootstrap materialization failed:", err instanceof Error ? err.message : err)
  }

  const created = await prisma.platformAdmin.findUnique({
    where: { userId },
    select: { id: true, role: true },
  })
  return created
}

interface ResolvedAdmin {
  adminRole: AdminRole
  platformAdminId: string | null
}

/**
 * Etkin kullanıcının platform rolü, ya da yönetici değilse null.
 *
 * Sıra: (1) DB satırı — devre dışıysa veya oturumu iptal edilmişse reddet,
 * (2) satır yoksa ve env'de adı geçiyorsa YALNIZ tablo boşken bootstrap.
 */
async function resolveAdmin(user: AuthUser): Promise<ResolvedAdmin | null> {
  if (!user.email) return null

  const row = await prisma.platformAdmin.findUnique({
    where: { userId: user.id },
    select: { id: true, role: true, disabledAt: true, sessionsValidFrom: true },
  })

  if (row) {
    if (row.disabledAt) return null
    if (isAdminSessionRevoked(await sessionAuthenticatedAt(), row.sessionsValidFrom)) return null
    return { adminRole: row.role, platformAdminId: row.id }
  }

  const bootstrapped = await bootstrapAdminIfEmpty(user.id, user.email)
  if (!bootstrapped) return null
  return { adminRole: bootstrapped.role, platformAdminId: bootstrapped.id }
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

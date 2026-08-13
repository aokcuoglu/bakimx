import { prisma } from "@/lib/db"
import type { UserRole } from "@prisma/client"
import { assertWriteAccess } from "@/lib/plan"
import type { Permission } from "@/lib/roles"

export interface AuthUser {
  id: string
  /** E-postasız (kullanıcı adıyla açılmış) hesaplarda NULL — BAK-40. */
  email: string | null
  /** Tenant içi giriş adı; e-posta ile açılmış hesaplarda NULL. */
  username: string | null
  workshopId: string
  firstName: string | null
  lastName: string | null
  role: UserRole
  isActive: boolean
  /** Set when this is a founder impersonation context (the real admin's id). */
  impersonatorAdminId?: string
  /** True when the impersonation context forbids tenant-data writes. */
  impersonationReadOnly?: boolean
}

const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  workshopId: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
} as const

/**
 * Oturum çerezini + impersonation katmanını okur.
 *
 * Yalnızca ÇEREZ OKUMA hataları burada yutulur: istek kapsamı dışında (cron,
 * script, build) `cookies()` fırlatır ve orada "oturum yok" doğru cevaptır.
 * Veritabanı hataları bilerek bu kapsamın DIŞINDA bırakılmıştır — onlar
 * `getCurrentUser()`'dan yukarı fırlar (bkz. auth-session-errors.test.ts).
 */
async function readSessionState() {
  try {
    const { getSession, getActiveImpersonation } = await import("@/lib/session")
    const impersonation = await getActiveImpersonation()
    const session = await getSession()
    return { session, impersonation }
  } catch {
    return null
  }
}

/**
 * Etkin kullanıcı, ya da oturum yoksa null.
 *
 * DİKKAT — null "kimlik çözülemedi" demektir, "altyapı çökük" demek DEĞİLDİR.
 * Bu ayrım kritiktir: eskiden DB hatası da null'a düşüyordu ve saniyelik bir
 * kesinti, o an sitede olan herkesi çıkışa yolluyordu. Artık DB hatası yukarı
 * fırlar ve hata sınırı "tekrar deneyin" ekranı gösterir.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const state = await readSessionState()
  if (!state) return null
  const { session, impersonation } = state

  // Impersonation overlay wins: resolve the EFFECTIVE user as the target. The
  // whole app scopes to the target tenant via the returned workshopId — no
  // per-query changes. The real admin identity stays on the overlay (audit).
  if (impersonation) {
    const target = await prisma.user.findUnique({
      where: { id: impersonation.targetUserId },
      select: USER_SELECT,
    })
    if (target) {
      return {
        ...target,
        impersonatorAdminId: impersonation.adminUserId,
        impersonationReadOnly: impersonation.readOnly,
      }
    }
    // Target vanished — fall through to the real session rather than 500.
  }

  if (!session?.userId) return null

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: USER_SELECT,
  })

  if (!user) return null

  return user
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error("Unauthorized")
  }
  // A seat deactivated mid-session must lose access immediately (not just at the
  // next login). Gating here covers every server action / page using requireAuth.
  if (!user.isActive) {
    throw new Error("Hesabınız devre dışı bırakılmıştır.")
  }
  return user
}

/**
 * Returns the current user with workshop data.
 * Throws if user or workshop is missing.
 * Use this for actions that need both user and workshop context.
 */
export async function getCurrentUserWithWorkshop() {
  const user = await requireAuth()
  const workshop = await prisma.workshop.findUnique({
    where: { id: user.workshopId },
  })
  if (!workshop) {
    throw new Error("Workshop not found — hesabınızla ilişkili bir iş yeri bulunamadı")
  }
  return { user, workshop }
}

/**
 * Like {@link getCurrentUserWithWorkshop}, but additionally enforces the plan
 * write gate: throws {@link PlanWriteLockedError} when the workshop is in the
 * read-only (plan-expired) state. Use this as the first line of any server
 * action that MUTATES tenant data, so an expired workshop can still read/list
 * everything but cannot write. Read-only actions should keep using
 * `requireAuth()` / `getCurrentUserWithWorkshop()`. Billing/purchase and auth
 * actions must stay exempt so a locked workshop can recover by paying.
 */
/**
 * Yazma yapan her server action'ın kapısı (#183).
 *
 * `permission` BİLEREK zorunlu: opsiyonel olsaydı yeni bir action eklerken
 * yazmayı unutmak sessiz bir yetki açığı olurdu. Zorunlu olduğu için derleyici
 * her çağrı yerini sınıflandırmaya zorlar.
 *
 * Sıra önemli: önce plan/abonelik yazma kilidi, sonra rol kapısı. Böylece plan
 * biten atölyede rol ne olursa olsun yazma yine kapalı.
 */
export async function requireWritableWorkshop(permission: Permission) {
  const { user, workshop } = await getCurrentUserWithWorkshop()
  assertWriteAccess(workshop)
  const { assertCan } = await import("@/lib/rbac")
  assertCan(user, permission)
  return { user, workshop }
}

/**
 * Asserts that the given entity belongs to the specified workshop.
 * Verifies:
 *  - entity is not null/undefined
 *  - entity.workshopId matches the provided workshopId
 *
 * Returns the entity if valid. Throws a descriptive error if access is denied.
 * This is a synchronous helper — call it after obtaining both entity and workshopId.
 */
export function assertWorkshopAccess<T extends { workshopId: string }>(
  entity: T | null | undefined,
  workshopId: string,
  entityLabel: string
): T {
  if (!entity) {
    throw new Error(`${entityLabel} bulunamadı`)
  }
  if (entity.workshopId !== workshopId) {
    throw new Error(`${entityLabel} bu iş yerine ait değil`)
  }
  return entity
}

/**
 * Checks if a given user is already authenticated on the server side.
 * Use in SSR layouts/pages that might render auth pages.
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return user !== null
}

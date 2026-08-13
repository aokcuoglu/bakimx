import { Prisma, type UserRole } from "@prisma/client"
import { prisma } from "@/lib/db"
import type { AuthUser } from "@/lib/auth"
import { ROLE_RANK, roleCan, type Permission } from "@/lib/roles"
import { getSeatLimit, seatLimitMessage, type PlanTier } from "@/lib/plan"

/**
 * Workshop-scoped role-based access control (server-only — imports prisma).
 *
 * Roller (#183):
 *  - owner   : Yönetici — her şey; kapalı iş emrini yeniden açabilen tek rol
 *  - manager : Servis Müdürü — ekip, ayarlar, kayıtlar, iş emri, katalog, kasa
 *  - usta    : Usta — kayıtlar, iş emri düzenleme/ilerletme, parça alımı
 *  - cirak   : Çırak — yalnız parça alımı ve maliyet girme
 *  - staff   : LEGACY — #183 öncesi kayıtlar; izinleri `usta` ile BİREBİR aynı
 *              (mevcut kullanıcılar yetki kaybetmesin diye). Yeni atanamaz.
 *
 * İzin kararı `ROLE_PERMISSIONS` matrisinden gelir; `ROLE_RANK` YALNIZ rol
 * atamada ("kendinden yükseğini atayamazsın") kullanılır. İkisini karıştırmak,
 * sırada yüksek görünen bir role istenmeyen izin verir.
 *
 * Kapı, server action'larda `requireWritableWorkshop(permission)` darboğazından
 * geçer; izin zorunlu parametredir, böylece yeni action yazarken atlanamaz.
 * Kapsamı `src/lib/rbac-coverage.test.ts` korur.
 *
 * Pure constants (labels/rank/assignable/matrix) live in `@/lib/roles` and are
 * re-exported here so existing server imports keep working.
 */
export {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_RANK,
  ASSIGNABLE_ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  roleCan,
  rolesUpTo,
  type Permission,
} from "@/lib/roles"

export function canManageTeam(role: UserRole): boolean {
  return roleCan(role, "team.manage")
}

export function canManageBilling(role: UserRole): boolean {
  return roleCan(role, "billing.manage")
}

/** İzin yoksa fırlatır. Server action'ların TEK kapı çağrısı budur (#183). */
export function assertCan(user: AuthUser, permission: Permission): void {
  if (!roleCan(user.role, permission)) {
    throw new PermissionError(permission)
  }
}

/**
 * Kapı hatası ayrı tip: action'lar bunu yakalayıp kullanıcıya okunur bir mesaj
 * dönebilsin, beklenmeyen hatalarla karışmasın.
 */
export class PermissionError extends Error {
  readonly permission: Permission
  constructor(permission: Permission) {
    super("Bu işlem için yetkiniz yok.")
    this.name = "PermissionError"
    this.permission = permission
  }
}

/**
 * Kapıyı `{ error }` sözleşmesine çeviren yardımcı: bu repodaki server action'lar
 * throw yerine `{ error }` döndürüyor, kapı da aynı dili konuşsun.
 */
export function permissionError(
  user: AuthUser,
  permission: Permission
): { error: string } | null {
  return roleCan(user.role, permission) ? null : { error: "Bu işlem için yetkiniz yok." }
}

/** Throws if the user may not manage the team. */
export function assertCanManageTeam(user: AuthUser): void {
  if (!canManageTeam(user.role)) {
    throw new Error("Bu işlem için yetkiniz yok.")
  }
}

/**
 * Throws if `actorRole` may not assign `targetRole`. Rule: you can never grant a
 * role higher than your own (so only an owner can create/promote an owner, and a
 * manager cannot mint owners). Prevents privilege escalation.
 */
export function assertCanAssignRole(actorRole: UserRole, targetRole: UserRole): void {
  if (ROLE_RANK[targetRole] > ROLE_RANK[actorRole]) {
    throw new Error("Kendinizden yüksek bir rol atayamazsınız.")
  }
}

/** Active login seats for a workshop. */
export function getActiveSeatCount(workshopId: string): Promise<number> {
  return prisma.user.count({ where: { workshopId, isActive: true } })
}

/**
 * Seat usage for a workshop. A "used" seat is an active login user OR a live
 * (non-expired) pending invite — pending invites reserve a seat so a batch of
 * invites can't all accept past the limit. Expired invites don't consume seats.
 */
export async function getSeatUsage(
  workshopId: string
): Promise<{ activeUsers: number; pendingInvites: number; used: number }> {
  const [activeUsers, pendingInvites] = await Promise.all([
    prisma.user.count({ where: { workshopId, isActive: true } }),
    prisma.invite.count({
      where: { workshopId, status: "pending", expiresAt: { gt: new Date() } },
    }),
  ])
  return { activeUsers, pendingInvites, used: activeUsers + pendingInvites }
}

/**
 * Koltuk limiti hatası ayrı tip (BAK-37): çağıran taraf bunu tanıyıp kullanıcıya
 * düz bir hata satırı yerine "paketi yükselt" yönlendirmesi gösterebilsin,
 * beklenmeyen hatalarla karışmasın. Mesaj `seatLimitMessage` ile üretilir —
 * `starter` paketinde limit 1 olduğu için o atölye HİÇ alt kullanıcı açamaz ve
 * bunu açıkça söylemek zorundayız.
 */
export class SeatLimitError extends Error {
  readonly used: number
  readonly limit: number
  readonly tier: PlanTier

  constructor(tier: PlanTier, used: number, limit: number) {
    super(seatLimitMessage(tier, used, limit))
    this.name = "SeatLimitError"
    this.tier = tier
    this.used = used
    this.limit = limit
  }
}

/**
 * Throws if adding ONE more seat would exceed the workshop's limit. Must be
 * called INSIDE a transaction that has already locked the Workshop row
 * (`SELECT ... FOR UPDATE`) so concurrent seat-consuming ops serialize.
 *
 * `used = active users + live pending invites`. Adding one (an accepted invite,
 * a reactivated user, or a re-activated expired invite) must keep used < limit,
 * i.e. block when `used >= limit`. Call AFTER consuming the invite being
 * accepted so it isn't double-counted.
 */
export async function assertSeatAvailableTx(
  tx: Prisma.TransactionClient,
  workshopId: string
): Promise<void> {
  const ws = await tx.workshop.findUnique({
    where: { id: workshopId },
    select: { planTier: true, extraSeats: true },
  })
  if (!ws) return
  const activeUsers = await tx.user.count({ where: { workshopId, isActive: true } })
  const livePending = await tx.invite.count({
    where: { workshopId, status: "pending", expiresAt: { gt: new Date() } },
  })
  const tier = (ws.planTier as PlanTier) ?? "starter"
  const limit = getSeatLimit(tier, ws.extraSeats)
  const used = activeUsers + livePending
  if (used >= limit) {
    throw new SeatLimitError(tier, used, limit)
  }
}

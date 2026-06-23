import { Prisma, type UserRole } from "@prisma/client"
import { prisma } from "@/lib/db"
import type { AuthUser } from "@/lib/auth"
import { ROLE_RANK } from "@/lib/roles"
import { getSeatLimit, type PlanTier } from "@/lib/plan"

/**
 * Workshop-scoped role-based access control (server-only — imports prisma).
 *
 * Hierarchy (rank): owner > manager > staff.
 *  - owner   : full control incl. team + (future) billing
 *  - manager : manage team (invite / change role of non-owners) + all operations
 *  - staff   : operational features only; no team management
 *
 * Pure constants (labels/rank/assignable) live in `@/lib/roles` and are
 * re-exported here so existing server imports keep working.
 */
export { ROLE_LABELS, ROLE_RANK, ASSIGNABLE_ROLES, rolesUpTo } from "@/lib/roles"

export function canManageTeam(role: UserRole): boolean {
  return role === "owner" || role === "manager"
}

export function canManageBilling(role: UserRole): boolean {
  return role === "owner"
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
  if (activeUsers + livePending >= getSeatLimit(ws.planTier as PlanTier, ws.extraSeats)) {
    throw new Error(
      "Koltuk limitiniz dolu. Önce bir koltuk boşaltın ya da paketinizi yükseltin."
    )
  }
}

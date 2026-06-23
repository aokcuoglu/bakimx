"use server"

import { z } from "zod/v4"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import type { UserRole } from "@prisma/client"
import { requireAuth, assertWorkshopAccess } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import {
  assertCanManageTeam,
  assertCanAssignRole,
  assertSeatAvailableTx,
  ROLE_LABELS,
  ROLE_RANK,
} from "@/lib/rbac"
import { generateInviteToken, inviteExpiry, buildInviteUrl, isInviteExpired } from "@/lib/invite"
import { getSeatLimit, type PlanTier } from "@/lib/plan"
import { escapeHtml } from "@/lib/html-escape"
import { sendEmailDirect } from "@/lib/communications"

type Ok = { ok: true; inviteUrl?: string }
type Err = { ok: false; error: string }
type Result = Ok | Err

const roleSchema = z.enum(["staff", "manager", "owner"])
const inviteSchema = z.object({
  email: z.email("Geçerli bir e-posta adresi giriniz"),
  role: roleSchema.default("staff"),
})

function fail(error: string): Err {
  return { ok: false, error }
}

async function requestOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

async function sendInviteEmail(opts: {
  email: string
  role: UserRole
  workshopName: string
  url: string
}) {
  const ws = escapeHtml(opts.workshopName)
  const subject = `${opts.workshopName} ekibine davet edildiniz`
  const html =
    `<p>Merhaba,</p>` +
    `<p><strong>${ws}</strong> sizi BakimX ekibine <strong>${ROLE_LABELS[opts.role]}</strong> olarak davet etti.</p>` +
    `<p><a href="${opts.url}">Daveti kabul edin ve şifrenizi belirleyin</a></p>` +
    `<p>Bu bağlantı 7 gün geçerlidir.</p>`
  const text = `${opts.workshopName} sizi BakimX ekibine davet etti. Kabul etmek için: ${opts.url} (7 gün geçerli)`
  try {
    await sendEmailDirect(opts.email, subject, html, text)
  } catch {
    // Non-fatal: the invite row + returned link still let the owner share it.
  }
}

/** Invite a teammate by e-mail. Owner/manager only. */
export async function inviteMemberAction(formData: FormData): Promise<Result> {
  const user = await requireAuth()
  try {
    assertCanManageTeam(user)

    const parsed = inviteSchema.safeParse({
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      role: String(formData.get("role") ?? "staff"),
    })
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Geçersiz bilgiler")
    const { email, role } = parsed.data

    assertCanAssignRole(user.role, role)
    if (email === user.email.toLowerCase()) return fail("Kendinizi davet edemezsiniz.")

    // Global e-mail uniqueness: an account can belong to only one workshop.
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { workshopId: true },
    })
    if (existing) {
      return fail(
        existing.workshopId === user.workshopId
          ? "Bu e-posta zaten ekibinizde kayıtlı."
          : "Bu e-posta başka bir hesaba bağlı. Farklı bir e-posta deneyin."
      )
    }

    const ws = await prisma.workshop.findUnique({
      where: { id: user.workshopId },
      select: { name: true, planTier: true, extraSeats: true },
    })

    const { token, tokenHash } = generateInviteToken()
    const now = new Date()
    const invite = await prisma.$transaction(async (tx) => {
      // Serialize seat-consuming operations for this workshop (closes the race
      // where two concurrent invites both pass the limit check).
      await tx.$queryRaw`SELECT id FROM "Workshop" WHERE id = ${user.workshopId} FOR UPDATE`

      // Re-inviting an already-live pending invite reuses its reserved seat.
      const existing = await tx.invite.findUnique({
        where: { workshopId_email: { workshopId: user.workshopId, email } },
        select: { status: true, expiresAt: true },
      })
      const reusesSeat = existing?.status === "pending" && existing.expiresAt > now

      if (!reusesSeat) {
        const activeUsers = await tx.user.count({
          where: { workshopId: user.workshopId, isActive: true },
        })
        const pendingInvites = await tx.invite.count({
          where: { workshopId: user.workshopId, status: "pending", expiresAt: { gt: now } },
        })
        const used = activeUsers + pendingInvites
        const limit = getSeatLimit((ws!.planTier as PlanTier) ?? "starter", ws!.extraSeats)
        if (used >= limit) {
          throw new Error(
            `Koltuk limitinize ulaştınız (${used}/${limit}). Daha fazla kullanıcı için paketinizi yükseltin ya da ek koltuk için iletişime geçin.`
          )
        }
      }

      return tx.invite.upsert({
        where: { workshopId_email: { workshopId: user.workshopId, email } },
        update: {
          role,
          tokenHash,
          status: "pending",
          expiresAt: inviteExpiry(),
          acceptedAt: null,
          createdByUserId: user.id,
        },
        create: {
          workshopId: user.workshopId,
          email,
          role,
          tokenHash,
          status: "pending",
          expiresAt: inviteExpiry(),
          createdByUserId: user.id,
        },
      })
    })

    await AuditLogAction(
      user.workshopId,
      user.id,
      "Invite",
      invite.id,
      "invite_sent",
      JSON.stringify({ email, role })
    )

    const url = buildInviteUrl(await requestOrigin(), token)
    await sendInviteEmail({ email, role, workshopName: ws?.name ?? "BakimX", url })

    revalidatePath("/app/settings")
    return { ok: true, inviteUrl: url }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "İşlem başarısız")
  }
}

/** Re-issue a pending invite (new token + e-mail). */
export async function resendInviteAction(inviteId: string): Promise<Result> {
  const user = await requireAuth()
  try {
    assertCanManageTeam(user)
    const invite = await prisma.invite.findUnique({ where: { id: inviteId } })
    assertWorkshopAccess(invite, user.workshopId, "Davet")
    // Don't let a lower rank re-issue/extend a higher-rank invite (e.g. a manager
    // keeping an owner invite alive).
    assertCanAssignRole(user.role, invite!.role)
    if (invite!.status !== "pending") return fail("Bu davet yeniden gönderilemez.")

    const ws = await prisma.workshop.findUnique({
      where: { id: user.workshopId },
      select: { name: true },
    })
    const { token, tokenHash } = generateInviteToken()
    // An expired invite no longer holds a seat — re-check the limit before
    // bringing it back to life. A still-live pending invite already holds its seat.
    const wasExpired = isInviteExpired(invite!.expiresAt)
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Workshop" WHERE id = ${user.workshopId} FOR UPDATE`
      if (wasExpired) {
        await assertSeatAvailableTx(tx, user.workshopId)
      }
      await tx.invite.update({
        where: { id: inviteId },
        data: { tokenHash, status: "pending", expiresAt: inviteExpiry(), acceptedAt: null },
      })
    })
    await AuditLogAction(user.workshopId, user.id, "Invite", inviteId, "invite_resent")

    const url = buildInviteUrl(await requestOrigin(), token)
    await sendInviteEmail({ email: invite!.email, role: invite!.role, workshopName: ws?.name ?? "BakimX", url })

    revalidatePath("/app/settings")
    return { ok: true, inviteUrl: url }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "İşlem başarısız")
  }
}

/** Revoke a pending invite (its link dies immediately). */
export async function revokeInviteAction(inviteId: string): Promise<Result> {
  const user = await requireAuth()
  try {
    assertCanManageTeam(user)
    const invite = await prisma.invite.findUnique({ where: { id: inviteId } })
    assertWorkshopAccess(invite, user.workshopId, "Davet")
    assertCanAssignRole(user.role, invite!.role)

    await prisma.invite.update({ where: { id: inviteId }, data: { status: "revoked" } })
    await AuditLogAction(user.workshopId, user.id, "Invite", inviteId, "invite_revoked")
    revalidatePath("/app/settings")
    return { ok: true }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "İşlem başarısız")
  }
}

/** Change a member's role. Guards: self, rank, assign-rank, last-owner. */
export async function updateMemberRoleAction(userId: string, role: string): Promise<Result> {
  const user = await requireAuth()
  try {
    assertCanManageTeam(user)
    const parsed = roleSchema.safeParse(role)
    if (!parsed.success) return fail("Geçersiz rol.")
    const newRole = parsed.data

    if (userId === user.id) return fail("Kendi rolünüzü değiştiremezsiniz.")
    assertCanAssignRole(user.role, newRole)

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, workshopId: true, role: true },
    })
    assertWorkshopAccess(target, user.workshopId, "Kullanıcı")
    // Cannot modify someone outranking you (e.g. a manager touching an owner).
    if (ROLE_RANK[target!.role] > ROLE_RANK[user.role]) {
      return fail("Bu kullanıcıyı düzenleme yetkiniz yok.")
    }

    // Last-owner protection: never demote the only remaining active owner.
    // Lock the active-owner rows + re-count + update atomically so two concurrent
    // demotions can't both pass the check and leave the workshop ownerless.
    const demotingOwner = target!.role === "owner" && newRole !== "owner"
    await prisma.$transaction(async (tx) => {
      // Lock the Workshop row so all owner/seat mutations serialize on one resource.
      await tx.$queryRaw`SELECT id FROM "Workshop" WHERE id = ${user.workshopId} FOR UPDATE`
      if (demotingOwner) {
        const activeOwners = await tx.user.count({
          where: { workshopId: user.workshopId, role: "owner", isActive: true },
        })
        if (activeOwners <= 1) {
          throw new Error("Son sahibi düşüremezsiniz. Önce başka bir sahip atayın.")
        }
      }
      await tx.user.update({ where: { id: userId }, data: { role: newRole } })
    })
    await AuditLogAction(
      user.workshopId,
      user.id,
      "User",
      userId,
      "member_role_changed",
      JSON.stringify({ from: target!.role, to: newRole })
    )
    revalidatePath("/app/settings")
    return { ok: true }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "İşlem başarısız")
  }
}

/** Activate / deactivate a member's seat. Guards: self, rank, last-owner. */
export async function setMemberActiveAction(userId: string, isActive: boolean): Promise<Result> {
  const user = await requireAuth()
  try {
    assertCanManageTeam(user)
    if (userId === user.id) return fail("Kendinizi devre dışı bırakamazsınız.")

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, workshopId: true, role: true },
    })
    assertWorkshopAccess(target, user.workshopId, "Kullanıcı")
    if (ROLE_RANK[target!.role] > ROLE_RANK[user.role]) {
      return fail("Bu kullanıcıyı düzenleme yetkiniz yok.")
    }

    await prisma.$transaction(async (tx) => {
      // Lock the Workshop row so all owner/seat mutations serialize on one resource.
      await tx.$queryRaw`SELECT id FROM "Workshop" WHERE id = ${user.workshopId} FOR UPDATE`
      // Last-owner protection: never deactivate the only remaining active owner.
      if (!isActive && target!.role === "owner") {
        const activeOwners = await tx.user.count({
          where: { workshopId: user.workshopId, role: "owner", isActive: true },
        })
        if (activeOwners <= 1) {
          throw new Error("Son aktif sahibi devre dışı bırakamazsınız.")
        }
      }
      // Reactivating a member consumes a seat — enforce the limit.
      if (isActive) {
        await assertSeatAvailableTx(tx, user.workshopId)
      }
      await tx.user.update({ where: { id: userId }, data: { isActive } })
    })
    await AuditLogAction(
      user.workshopId,
      user.id,
      "User",
      userId,
      isActive ? "member_activated" : "member_deactivated"
    )
    revalidatePath("/app/settings")
    return { ok: true }
  } catch (e) {
    return fail(e instanceof Error ? e.message : "İşlem başarısız")
  }
}

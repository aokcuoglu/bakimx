"use server"

import { z } from "zod/v4"
import bcrypt from "bcryptjs"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import type { UserRole } from "@prisma/client"
import { requireAuth, requireWritableWorkshop, assertWorkshopAccess } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import {
  assertCanManageTeam,
  assertCanAssignRole,
  assertSeatAvailableTx,
  SeatLimitError,
  ROLE_LABELS,
  ROLE_RANK,
} from "@/lib/rbac"
import { generateInviteToken, inviteExpiry, buildInviteUrl, isInviteExpired } from "@/lib/invite"
import { getSeatLimit, type PlanTier } from "@/lib/plan"
import { escapeHtml } from "@/lib/html-escape"
import { rateLimit } from "@/lib/rate-limit"
import { isUniqueConstraintError } from "@/lib/prisma-errors"
import { sendEmailDirect } from "@/lib/communications"
import {
  isValidUsername,
  normalizeUsername,
  roleAllowedForUser,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/user-identity"
import { generateTempPassword } from "@/lib/temp-password"
import { personnelName, technicianRoleForUser } from "@/lib/personnel"

type Ok = { ok: true; inviteUrl?: string }
/**
 * `code` yalnız arayüzün AYRI davranması gereken hatalar için doldurulur —
 * koltuk limiti düz bir hata satırı değil, paket yükseltme yönlendirmesi
 * göstermeli (BAK-37).
 */
type ErrCode = "seat_limit"
type Err = { ok: false; error: string; code?: ErrCode }
type Result = Ok | Err

/** Geçici şifre YALNIZ bu cevapta görünür; DB'de bcrypt özeti durur, log'a hiç düşmez. */
export type IssuedCredentials = {
  fullName: string
  username: string
  tempPassword: string
}
type CredentialsResult = { ok: true; credentials: IssuedCredentials } | Err

const roleSchema = z.enum(["cirak", "usta", "manager", "owner"])
const inviteSchema = z.object({
  email: z.email("Geçerli bir e-posta adresi giriniz"),
  role: roleSchema.default("usta"),
})

/**
 * E-postasız yoldan açılabilen roller. `owner`/`manager` BİLEREK yok: onlarda
 * e-posta zorunludur (BAK-40 kuralı, DB CHECK'i ile de zorlanır) ve e-posta
 * davetiyle gelirler.
 */
const localMemberRoleSchema = z.enum(["usta", "cirak"])

const localMemberSchema = z.object({
  firstName: z.string().trim().min(1, "Ad zorunludur").max(60),
  lastName: z.string().trim().min(1, "Soyad zorunludur").max(60),
  username: z
    .string()
    .trim()
    .min(USERNAME_MIN_LENGTH, `Kullanıcı adı en az ${USERNAME_MIN_LENGTH} karakter olmalıdır`)
    .max(USERNAME_MAX_LENGTH, `Kullanıcı adı en fazla ${USERNAME_MAX_LENGTH} karakter olabilir`),
  role: localMemberRoleSchema,
})

const USERNAME_FORMAT_MESSAGE =
  "Kullanıcı adı yalnız küçük harf, rakam, nokta, tire ve alt tire içerebilir."
const USERNAME_TAKEN_MESSAGE = "Bu kullanıcı adı iş yerinizde zaten kullanılıyor."

function fail(error: string, code?: ErrCode): Err {
  return code ? { ok: false, error, code } : { ok: false, error }
}

/**
 * Bilinen hataları (`SeatLimitError`, kapı hataları) kullanıcının okuyabileceği
 * cevaba çevirir.
 *
 * Prisma hatalarının mesajı BİLEREK dışarı verilmez: kullanıcıya "Unique
 * constraint failed on the fields: (`workshopId`, `username`)" göstermek hem
 * anlamsız hem de şema detayı sızdırır. Onlar `code` taşıdıkları için ayırt
 * edilir (davet kabul akışındaki desenin aynısı) ve sunucuya loglanır.
 */
function toErr(e: unknown, fallback = "İşlem başarısız"): Err {
  if (e instanceof SeatLimitError) return fail(e.message, "seat_limit")
  const code = (e as { code?: string })?.code
  if (e instanceof Error && !code) return fail(e.message || fallback)
  console.error("[team-actions] beklenmeyen hata:", e)
  return fail(fallback)
}

/** Prisma benzersizlik ihlali `User.username` üzerinde mi? */
function isUsernameConflict(error: unknown): boolean {
  return isUniqueConstraintError(error, "username")
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
  const { user } = await requireWritableWorkshop("team.manage")
  try {
    assertCanManageTeam(user)

    const parsed = inviteSchema.safeParse({
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      role: String(formData.get("role") ?? "staff"),
    })
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Geçersiz bilgiler")
    const { email, role } = parsed.data

    assertCanAssignRole(user.role, role)
    if (user.email && email === user.email.toLowerCase()) return fail("Kendinizi davet edemezsiniz.")

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
        const tier = (ws!.planTier as PlanTier) ?? "starter"
        const limit = getSeatLimit(tier, ws!.extraSeats)
        if (used >= limit) {
          throw new SeatLimitError(tier, used, limit)
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

    revalidatePath("/settings")
    return { ok: true, inviteUrl: url }
  } catch (e) {
    return toErr(e)
  }
}

/** Re-issue a pending invite (new token + e-mail). */
export async function resendInviteAction(inviteId: string): Promise<Result> {
  const { user } = await requireWritableWorkshop("team.manage")
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

    revalidatePath("/settings")
    return { ok: true, inviteUrl: url }
  } catch (e) {
    return toErr(e)
  }
}

/** Revoke a pending invite (its link dies immediately). */
export async function revokeInviteAction(inviteId: string): Promise<Result> {
  const { user } = await requireWritableWorkshop("team.manage")
  try {
    assertCanManageTeam(user)
    const invite = await prisma.invite.findUnique({ where: { id: inviteId } })
    assertWorkshopAccess(invite, user.workshopId, "Davet")
    assertCanAssignRole(user.role, invite!.role)

    await prisma.invite.update({ where: { id: inviteId }, data: { status: "revoked" } })
    await AuditLogAction(user.workshopId, user.id, "Invite", inviteId, "invite_revoked")
    revalidatePath("/settings")
    return { ok: true }
  } catch (e) {
    return toErr(e)
  }
}

/** Change a member's role. Guards: self, rank, assign-rank, last-owner. */
export async function updateMemberRoleAction(userId: string, role: string): Promise<Result> {
  const { user } = await requireWritableWorkshop("team.manage")
  try {
    assertCanManageTeam(user)
    const parsed = roleSchema.safeParse(role)
    if (!parsed.success) return fail("Geçersiz rol.")
    const newRole = parsed.data

    if (userId === user.id) return fail("Kendi rolünüzü değiştiremezsiniz.")
    assertCanAssignRole(user.role, newRole)

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        workshopId: true,
        role: true,
        email: true,
        technicianId: true,
      },
    })
    assertWorkshopAccess(target, user.workshopId, "Kullanıcı")
    // Cannot modify someone outranking you (e.g. a manager touching an owner).
    if (ROLE_RANK[target!.role] > ROLE_RANK[user.role]) {
      return fail("Bu kullanıcıyı düzenleme yetkiniz yok.")
    }

    // Rol yükseltme kapısı (BAK-40): kullanıcı adıyla açılmış e-postasız bir
    // hesap, e-posta eklenmeden owner/manager olamaz — fatura, şifre sıfırlama
    // ve sistem bildirimleri oraya gidiyor. DB'deki CHECK aynı kuralı zorluyor;
    // burası kullanıcıya ham kısıt hatası yerine anlaşılır bir cevap verir.
    if (!roleAllowedForUser(newRole, target!)) {
      return fail(
        `${ROLE_LABELS[newRole]} rolü için e-posta adresi zorunludur. Önce kullanıcıya e-posta ekleyin.`
      )
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
      if (target!.technicianId) {
        await tx.technician.update({
          where: { id: target!.technicianId },
          data: { role: technicianRoleForUser(newRole) },
        })
      }
    })
    await AuditLogAction(
      user.workshopId,
      user.id,
      "User",
      userId,
      "member_role_changed",
      JSON.stringify({ from: target!.role, to: newRole })
    )
    revalidatePath("/settings")
    return { ok: true }
  } catch (e) {
    return toErr(e)
  }
}

/** Activate / deactivate a member's seat. Guards: self, rank, last-owner. */
export async function setMemberActiveAction(userId: string, isActive: boolean): Promise<Result> {
  const { user } = await requireWritableWorkshop("team.manage")
  try {
    assertCanManageTeam(user)
    if (userId === user.id) return fail("Kendinizi devre dışı bırakamazsınız.")

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, workshopId: true, role: true, technicianId: true },
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
      if (target!.technicianId) {
        await tx.technician.update({ where: { id: target!.technicianId }, data: { isActive } })
      }
    })
    await AuditLogAction(
      user.workshopId,
      user.id,
      "User",
      userId,
      isActive ? "member_activated" : "member_deactivated"
    )
    revalidatePath("/settings")
    return { ok: true }
  } catch (e) {
    return toErr(e)
  }
}

/**
 * Kullanıcı adı bu iş yerinde müsait mi? (BAK-37)
 *
 * Salt-okunur; formda debounce ile çağrılır. Kapsam KENDİ tenant'ı olduğu için
 * bilgi sızıntısı yok — sahibin zaten ekip listesinde gördüğü şeyi söylüyor.
 * Yine de `team.manage` isteriz: kullanıcı adı listesi, davet edilmemiş birinin
 * işine yarayacak bir bilgi değil.
 */
export async function checkUsernameAvailabilityAction(
  value: string
): Promise<{ available: boolean; error?: string }> {
  const user = await requireAuth()
  try {
    assertCanManageTeam(user)
  } catch {
    return { available: false, error: "Bu işlem için yetkiniz yok." }
  }

  // Tuş başına bir sorgu atılmasın diye üst sınır; form zaten debounce'lu.
  if (!(await rateLimit(`username-check:${user.id}`, 60, 60_000)).allowed) {
    return { available: false, error: "Çok fazla deneme. Bir dakika sonra tekrar deneyin." }
  }

  const username = normalizeUsername(value)
  if (username.length < USERNAME_MIN_LENGTH) {
    return { available: false, error: `En az ${USERNAME_MIN_LENGTH} karakter olmalıdır` }
  }
  if (username.length > USERNAME_MAX_LENGTH) {
    return { available: false, error: `En fazla ${USERNAME_MAX_LENGTH} karakter olabilir` }
  }
  if (!isValidUsername(username)) {
    return { available: false, error: USERNAME_FORMAT_MESSAGE }
  }

  const taken = await prisma.user.findUnique({
    where: { workshopId_username: { workshopId: user.workshopId, username } },
    select: { id: true },
  })
  return taken ? { available: false, error: USERNAME_TAKEN_MESSAGE } : { available: true }
}

/**
 * E-postası olmayan bir usta/çırak hesabı açar ve TEK SEFERLİK geçici şifresini
 * döndürür (BAK-37).
 *
 * Mevcut e-posta davet akışı (`inviteMemberAction`) olduğu gibi duruyor — büro
 * personeli ve müdürler oradan gelir. İkisi yan yana çalışır.
 *
 * Koltuk davranışı değişmiyor: kullanıcı adıyla giren personel de NORMAL koltuk
 * sayılır, aynı `assertSeatAvailableTx` kapısından geçer. Bu kritik: `starter`
 * paketinde limit 1'dir, yani o atölye hiç alt kullanıcı açamaz ve hata mesajı
 * bunu açıkça söyleyip yükseltmeye yönlendirir (bkz. `seatLimitMessage`).
 */
export async function createLocalMemberAction(formData: FormData): Promise<CredentialsResult> {
  const { user } = await requireWritableWorkshop("team.manage")
  try {
    assertCanManageTeam(user)

    const parsed = localMemberSchema.safeParse({
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      username: String(formData.get("username") ?? ""),
      role: String(formData.get("role") ?? "usta"),
    })
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Geçersiz bilgiler")
    }
    const { firstName, lastName, role } = parsed.data
    const technicianId = String(formData.get("technicianId") ?? "").trim() || null
    const username = normalizeUsername(parsed.data.username)
    if (!isValidUsername(username)) return fail(USERNAME_FORMAT_MESSAGE)

    // Rol kapısı korunur: kimse kendinden yüksek rol atayamaz. `owner`/`manager`
    // zaten şemadan geçemez (e-posta zorunlu).
    assertCanAssignRole(user.role, role)

    // Şifre yalnız BURADA düz metin olarak var: hash'i DB'ye, kendisi tek bir
    // cevapla arayüze gider. Hiçbir log/audit satırına yazılmaz.
    const tempPassword = generateTempPassword()
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    const created = await prisma.$transaction(async (tx) => {
      // Koltuk tüketen tüm işlemler tek kaynağa serileşsin (mevcut desen).
      await tx.$queryRaw`SELECT id FROM "Workshop" WHERE id = ${user.workshopId} FOR UPDATE`
      await assertSeatAvailableTx(tx, user.workshopId)

      const technician = technicianId
        ? await tx.technician.findFirst({
            where: {
              id: technicianId,
              workshopId: user.workshopId,
              linkedUsers: { none: {} },
            },
          })
        : await tx.technician.create({
            data: {
              workshopId: user.workshopId,
              fullName: personnelName(firstName, lastName, username),
              phone: "",
              role: technicianRoleForUser(role),
            },
          })
      if (!technician) throw new Error("Personel kaydı bulunamadı veya başka bir hesaba bağlı.")
      if (technicianId) {
        await tx.technician.update({
          where: { id: technician.id },
          data: {
            fullName: personnelName(firstName, lastName, username),
            role: technicianRoleForUser(role),
            isActive: true,
          },
        })
      }
      return tx.user.create({
        data: {
          email: null,
          username,
          password: passwordHash,
          firstName,
          lastName,
          workshopId: user.workshopId,
          role,
          isActive: true,
          mustChangePassword: true,
          technicianId: technician.id,
        },
        select: { id: true, firstName: true, lastName: true, username: true },
      })
    })

    await AuditLogAction(
      user.workshopId,
      user.id,
      "User",
      created.id,
      "member_created_local",
      JSON.stringify({ username, role })
    )

    revalidatePath("/settings")
    return {
      ok: true,
      credentials: {
        fullName: `${firstName} ${lastName}`.trim(),
        username,
        tempPassword,
      },
    }
  } catch (e) {
    if (isUsernameConflict(e)) return fail(USERNAME_TAKEN_MESSAGE)
    return toErr(e, "Kullanıcı oluşturulamadı")
  }
}

/**
 * E-postasız bir üyenin şifresini sıfırlar: yeni geçici şifre üretilir ve
 * `mustChangePassword` tekrar dolar (BAK-37).
 *
 * Bu yol e-posta davetiyle gelmiş üyeler için KAPALIDIR — onların "şifremi
 * unuttum" akışı var ve panelden şifre üretmek, e-postası olan bir hesabı
 * sahibine haber vermeden devralmanın kısa yolu olurdu.
 */
export async function resetMemberPasswordAction(userId: string): Promise<CredentialsResult> {
  const { user } = await requireWritableWorkshop("team.manage")
  try {
    assertCanManageTeam(user)
    if (userId === user.id) {
      return fail("Kendi şifrenizi buradan sıfırlayamazsınız.")
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        workshopId: true,
        role: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
      },
    })
    assertWorkshopAccess(target, user.workshopId, "Kullanıcı")
    if (ROLE_RANK[target!.role] > ROLE_RANK[user.role]) {
      return fail("Bu kullanıcıyı düzenleme yetkiniz yok.")
    }
    if (target!.email || !target!.username) {
      return fail(
        "Bu kullanıcının e-posta adresi var; şifresini “Şifremi unuttum” ile kendisi sıfırlayabilir."
      )
    }

    const tempPassword = generateTempPassword()
    const passwordHash = await bcrypt.hash(tempPassword, 12)
    await prisma.user.update({
      where: { id: target!.id },
      data: { password: passwordHash, mustChangePassword: true },
    })

    await AuditLogAction(
      user.workshopId,
      user.id,
      "User",
      target!.id,
      "member_password_reset",
      JSON.stringify({ username: target!.username })
    )

    revalidatePath("/settings")
    return {
      ok: true,
      credentials: {
        fullName:
          `${target!.firstName ?? ""} ${target!.lastName ?? ""}`.trim() || target!.username!,
        username: target!.username!,
        tempPassword,
      },
    }
  } catch (e) {
    return toErr(e, "Şifre sıfırlanamadı")
  }
}

/**
 * Kullanıcıyı teknicyen kaydıyla eşleştir ya da bağı kaldır (BAK-39).
 *
 * Bağlı kullanıcılar teknisyen panelinde kendi işlerini görür; bağlı olmayan
 * kullanıcılar URL parametresine veya ilk teknisyene düşer.
 */
export async function setMemberTechnicianAction(
  userId: string,
  technicianId: string | null
): Promise<Result> {
  const { user } = await requireWritableWorkshop("team.manage")
  try {
    assertCanManageTeam(user)

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, workshopId: true, role: true },
    })
    assertWorkshopAccess(target, user.workshopId, "Kullanıcı")

    // Teknicyen var ise, aynı workshop'a ait olduğunu doğrula.
    if (technicianId) {
      const technician = await prisma.technician.findUnique({
        where: { id: technicianId },
        select: { id: true, workshopId: true },
      })
      if (!technician || technician.workshopId !== user.workshopId) {
        return fail("Bu teknisyen bulunamadı.")
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { technicianId },
    })

    await AuditLogAction(
      user.workshopId,
      user.id,
      "User",
      userId,
      "member_technician_linked",
      JSON.stringify({ technicianId })
    )

    revalidatePath("/settings")
    return { ok: true }
  } catch (e) {
    return toErr(e)
  }
}

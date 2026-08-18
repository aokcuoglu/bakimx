"use server"

import { revalidatePath } from "next/cache"
import { requireAdminCapability, type AdminRole } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { addPlatformAdminSchema, platformAdminRoleSchema } from "@/lib/validations/platform-admin"

type Result = { ok: true } | { ok: false; error: string }

/**
 * Platform yöneticisi yönetimi (BAK-93).
 *
 * YETKİ: her action AYRI AYRI `requireAdminCapability("manageAdmins")` çağırır —
 * `/admin/layout.tsx` guard'ı server action'lara MİRAS KALMAZ.
 *
 * Satır hiç SİLİNMEZ: `disabledAt` ile kapatılır. Böylece denetim kaydındaki
 * "kim yaptı" bağı ve geçmişte kimin yönetici olduğu bilgisi korunur.
 */

/** Denetim kaydı atölye-bazlıdır; platform işlemleri HEDEF kullanıcının atölyesine yazılır. */
async function auditPlatformAdmin(
  targetUserId: string,
  actorUserId: string,
  platformAdminId: string,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { workshopId: true },
  })
  if (!target) return
  await AuditLogAction(
    target.workshopId,
    actorUserId,
    "PlatformAdmin",
    platformAdminId,
    action,
    metadata ? JSON.stringify(metadata) : undefined
  )
}

/**
 * Kilitlenme koruması: erişimi olan en az bir `founder` HER ZAMAN kalmalı.
 * `excludeId` — üzerinde işlem yapılan satır (rolü düşürülüyor / kapatılıyor).
 */
async function otherActiveFounderExists(excludeId: string): Promise<boolean> {
  const count = await prisma.platformAdmin.count({
    where: { role: "founder", disabledAt: null, id: { not: excludeId } },
  })
  return count > 0
}

/** E-postasıyla bir kullanıcıyı platform yöneticisi yap. Devre dışı satır varsa yeniden açar. */
export async function addPlatformAdmin(input: unknown): Promise<Result> {
  const ctx = await requireAdminCapability("manageAdmins")

  const parsed = addPlatformAdminSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }
  const { email, role } = parsed.data

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, isActive: true },
  })
  if (!user || !user.email) {
    return {
      ok: false,
      error: "Bu e-postayla bir kullanıcı yok. Önce hesabı açın, sonra yönetici yapın.",
    }
  }
  if (!user.isActive) {
    return { ok: false, error: "Kullanıcı hesabı devre dışı; önce hesabı etkinleştirin." }
  }

  const existing = await prisma.platformAdmin.findUnique({
    where: { userId: user.id },
    select: { id: true, disabledAt: true },
  })
  if (existing && !existing.disabledAt) {
    return { ok: false, error: "Bu kullanıcı zaten yönetici." }
  }

  const row = existing
    ? await prisma.platformAdmin.update({
        where: { id: existing.id },
        data: { role, disabledAt: null, createdByUserId: ctx.user.id },
        select: { id: true },
      })
    : await prisma.platformAdmin.create({
        data: { userId: user.id, role, createdByUserId: ctx.user.id },
        select: { id: true },
      })

  await auditPlatformAdmin(user.id, ctx.user.id, row.id, "platform_admin_added", {
    email: user.email,
    role,
    reactivated: Boolean(existing),
  })
  revalidatePath("/admin/admins")
  return { ok: true }
}

/** Rol değiştir. Son aktif kuruculuk düşürülemez. */
export async function changePlatformAdminRole(id: string, role: string): Promise<Result> {
  const ctx = await requireAdminCapability("manageAdmins")
  if (!id) return { ok: false, error: "Yönetici seçilmedi." }

  const parsed = platformAdminRoleSchema.safeParse(role)
  if (!parsed.success) return { ok: false, error: "Geçersiz rol." }
  const nextRole: AdminRole = parsed.data

  const row = await prisma.platformAdmin.findUnique({
    where: { id },
    select: { id: true, userId: true, role: true, disabledAt: true },
  })
  if (!row) return { ok: false, error: "Yönetici bulunamadı." }
  if (row.role === nextRole) return { ok: true }

  if (row.role === "founder" && !row.disabledAt && !(await otherActiveFounderExists(id))) {
    return { ok: false, error: "Son aktif kurucunun rolü düşürülemez." }
  }

  await prisma.platformAdmin.update({ where: { id }, data: { role: nextRole } })
  await auditPlatformAdmin(row.userId, ctx.user.id, id, "platform_admin_role_changed", {
    from: row.role,
    to: nextRole,
  })
  revalidatePath("/admin/admins")
  return { ok: true }
}

/**
 * Erişimi kapat / geri aç.
 *
 * Kapatma AÇIK OTURUMU da keser: `sessionsValidFrom` aynı anda `now()` yapılır,
 * böylece kişinin duran sekmesi bir sonraki `/admin` isteğinde 404 alır. Yalnız
 * yeni girişi engellemek yetmezdi — çerez 7 gün yaşıyor.
 */
export async function setPlatformAdminDisabled(id: string, disabled: boolean): Promise<Result> {
  const ctx = await requireAdminCapability("manageAdmins")
  if (!id) return { ok: false, error: "Yönetici seçilmedi." }

  const row = await prisma.platformAdmin.findUnique({
    where: { id },
    select: { id: true, userId: true, role: true, disabledAt: true },
  })
  if (!row) return { ok: false, error: "Yönetici bulunamadı." }

  if (disabled) {
    if (row.userId === ctx.user.id) {
      return { ok: false, error: "Kendi erişiminizi kapatamazsınız." }
    }
    if (row.role === "founder" && !row.disabledAt && !(await otherActiveFounderExists(id))) {
      return { ok: false, error: "Son aktif kurucunun erişimi kapatılamaz." }
    }
  }

  const now = new Date()
  await prisma.platformAdmin.update({
    where: { id },
    data: disabled ? { disabledAt: now, sessionsValidFrom: now } : { disabledAt: null },
  })
  await auditPlatformAdmin(
    row.userId,
    ctx.user.id,
    id,
    disabled ? "platform_admin_disabled" : "platform_admin_enabled"
  )
  revalidatePath("/admin/admins")
  return { ok: true }
}

/** Açık oturumlarını geçersiz kıl — kişi yönetici kalır, yeniden giriş yapması gerekir. */
export async function revokePlatformAdminSessions(id: string): Promise<Result> {
  const ctx = await requireAdminCapability("manageAdmins")
  if (!id) return { ok: false, error: "Yönetici seçilmedi." }

  const row = await prisma.platformAdmin.findUnique({
    where: { id },
    select: { id: true, userId: true },
  })
  if (!row) return { ok: false, error: "Yönetici bulunamadı." }

  const now = new Date()
  await prisma.platformAdmin.update({ where: { id }, data: { sessionsValidFrom: now } })
  await auditPlatformAdmin(row.userId, ctx.user.id, id, "platform_admin_sessions_revoked", {
    sessionsValidFrom: now.toISOString(),
  })
  revalidatePath("/admin/admins")
  return { ok: true }
}

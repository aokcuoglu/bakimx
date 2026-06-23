"use server"

import { z } from "zod/v4"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { hashInviteToken, isInviteExpired } from "@/lib/invite"
import { assertSeatAvailableTx } from "@/lib/rbac"

type Result = { ok: true } | { ok: false; error: string }

const acceptSchema = z.object({
  firstName: z.string().min(1, "Ad zorunludur"),
  lastName: z.string().min(1, "Soyad zorunludur"),
  password: z.string().min(8, "Şifre en az 8 karakter olmalıdır"),
})

/**
 * Accept a team invite and create the user. All validation is re-done here
 * server-side (never trust the page render): token hash, pending status, not
 * expired, e-mail still free. User + invite update run in one transaction.
 */
export async function acceptInviteAction(token: string, formData: FormData): Promise<Result> {
  const parsed = acceptSchema.safeParse({
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz bilgiler" }
  }

  const tokenHash = hashInviteToken(token)
  const invite = await prisma.invite.findUnique({ where: { tokenHash } })
  // Cheap pre-checks for friendly errors (re-validated atomically below).
  if (!invite || invite.status !== "pending") {
    return { ok: false, error: "Bu davet artık geçerli değil." }
  }
  if (isInviteExpired(invite.expiresAt)) {
    return { ok: false, error: "Davetin süresi dolmuş. Yeni bir davet isteyin." }
  }
  if (await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } })) {
    return { ok: false, error: "Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin." }
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)

  try {
    const newUser = await prisma.$transaction(async (tx) => {
      const fresh = await tx.invite.findUnique({ where: { tokenHash } })
      if (!fresh || fresh.status !== "pending" || isInviteExpired(fresh.expiresAt)) {
        throw new Error("Bu davet artık geçerli değil.")
      }

      // Serialize all seat-consuming ops for this workshop (closes the race where
      // multiple invitees accept concurrently and overshoot the seat limit).
      await tx.$queryRaw`SELECT id FROM "Workshop" WHERE id = ${fresh.workshopId} FOR UPDATE`

      // A workshop rejected after the invite was sent must not gain a user.
      const ws = await tx.workshop.findUnique({
        where: { id: fresh.workshopId },
        select: { approvalStatus: true },
      })
      if (ws?.approvalStatus !== "approved") {
        throw new Error("Bu iş yeri devre dışı bırakılmış. Lütfen iş yeriyle görüşün.")
      }

      // Consume the invite (atomic gate against double-accept).
      const consumed = await tx.invite.updateMany({
        where: { id: fresh.id, status: "pending" },
        data: { status: "accepted", acceptedAt: new Date() },
      })
      if (consumed.count !== 1) {
        throw new Error("Bu davet artık geçerli değil.")
      }

      // Seat guard (after consuming, so this invite isn't double-counted). Catches
      // a plan downgrade or any combined over-allocation since the invite was sent.
      await assertSeatAvailableTx(tx, fresh.workshopId)

      return tx.user.create({
        data: {
          email: fresh.email,
          password: passwordHash,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          workshopId: fresh.workshopId,
          role: fresh.role,
          isActive: true,
        },
      })
    })

    await AuditLogAction(newUser.workshopId, newUser.id, "Invite", invite.id, "invite_accepted")
    return { ok: true }
  } catch (err) {
    const code = (err as { code?: string })?.code
    if (code === "P2002") {
      return { ok: false, error: "Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin." }
    }
    // Our intentional validation throws (seat limit, invite no longer valid) carry
    // a user-facing Turkish message and no Prisma error code — surface them.
    if (err instanceof Error && !code) {
      return { ok: false, error: err.message }
    }
    console.error("[accept-invite] failed:", err)
    return { ok: false, error: "Hesap oluşturulamadı. Lütfen tekrar deneyin." }
  }
}

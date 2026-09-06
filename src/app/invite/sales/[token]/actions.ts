"use server"

import bcrypt from "bcryptjs"
import { AuditLogAction } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { isUniqueConstraintError } from "@/lib/prisma-errors"
import {
  hashSalesAdvisorInviteToken,
  isSalesAdvisorInviteExpired,
} from "@/lib/sales/advisor-invite"
import { salesAdvisorAcceptSchema } from "@/lib/validations/sales-advisor"

type Result = { ok: true } | { ok: false; error: string }

class InviteAcceptanceError extends Error {}

export async function acceptSalesAdvisorInvite(token: string, input: unknown): Promise<Result> {
  const parsed = salesAdvisorAcceptSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz bilgiler." }
  }
  const tokenHash = hashSalesAdvisorInviteToken(token)
  const passwordHash = await bcrypt.hash(parsed.data.password, 12)

  try {
    const accepted = await prisma.$transaction(async (tx) => {
      const invite = await tx.salesAdvisorInvite.findUnique({ where: { tokenHash } })
      if (!invite || invite.status !== "pending" || isSalesAdvisorInviteExpired(invite.expiresAt)) {
        throw new InviteAcceptanceError("Bu davet artık geçerli değil.")
      }
      const workshop = await tx.workshop.findFirst({
        where: { kind: "internal" },
        select: { id: true },
      })
      if (!workshop) throw new InviteAcceptanceError("İç operasyon hesabı hazırlanamadı.")
      const existingUser = await tx.user.findUnique({
        where: { email: invite.email },
        select: { id: true },
      })
      if (existingUser) throw new InviteAcceptanceError("Bu e-posta zaten bir BakımX hesabına bağlı.")

      const consumed = await tx.salesAdvisorInvite.updateMany({
        where: { id: invite.id, status: "pending", expiresAt: { gt: new Date() } },
        data: { status: "accepted", acceptedAt: new Date() },
      })
      if (consumed.count !== 1) throw new InviteAcceptanceError("Bu davet artık geçerli değil.")

      const user = await tx.user.create({
        data: {
          email: invite.email,
          password: passwordHash,
          firstName: invite.firstName,
          lastName: invite.lastName,
          workshopId: workshop.id,
          role: "staff",
          isActive: true,
        },
      })
      const advisor = await tx.salesAdvisor.create({ data: { userId: user.id } })
      return { inviteId: invite.id, workshopId: workshop.id, userId: user.id, advisorId: advisor.id }
    })

    // Hesap transaction'ı başarıyla commit edildikten sonra gözlemlenebilirlik
    // arızası kullanıcıya sahte bir "oluşturulamadı" sonucu göstermemeli.
    await AuditLogAction(
      accepted.workshopId,
      accepted.userId,
      "SalesAdvisorInvite",
      accepted.inviteId,
      "sales_advisor_invite_accepted",
      JSON.stringify({ advisorId: accepted.advisorId }),
    ).catch((error) => {
      console.error("[sales-advisor-invite] acceptance audit failed:", error)
    })
    return { ok: true }
  } catch (error) {
    if (error instanceof InviteAcceptanceError) return { ok: false, error: error.message }
    if (isUniqueConstraintError(error, "email") || isUniqueConstraintError(error, "userId")) {
      return { ok: false, error: "Bu davet daha önce kullanılmış veya e-posta zaten kayıtlı." }
    }
    console.error("[sales-advisor-invite] accept failed:", error)
    return { ok: false, error: "Hesap oluşturulamadı. Lütfen tekrar deneyin." }
  }
}

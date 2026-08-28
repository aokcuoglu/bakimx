"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { AuditLogAction } from "@/lib/audit"
import { prisma } from "@/lib/db"
import { escapeHtml } from "@/lib/html-escape"
import { sendSystemEmail } from "@/lib/emails/send-system-email"
import { renderEmailLayout } from "@/lib/emails/layout"
import {
  buildSalesAdvisorInviteUrl,
  generateSalesAdvisorInviteToken,
  salesAdvisorInviteExpiry,
} from "@/lib/sales/advisor-invite"
import { getSalesAccess } from "@/lib/sales/access"
import { salesAdvisorInviteSchema } from "@/lib/validations/sales-advisor"

type Result = { ok: true; inviteUrl?: string; warning?: string } | { ok: false; error: string }

async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers()
  const host = requestHeaders.get("host") ?? "localhost:3000"
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return `${protocol}://${host}`
}

async function internalWorkshop() {
  const workshop = await prisma.workshop.findFirst({
    where: { kind: "internal" },
    select: { id: true, name: true },
  })
  if (!workshop) throw new Error("BakımX İç Operasyon iş yeri bulunamadı. Migration durumunu kontrol edin.")
  return workshop
}

async function deliverInvite(email: string, firstName: string, url: string, workshopId: string) {
  const safeName = escapeHtml(firstName)
  return sendSystemEmail({
    to: email,
    subject: "BakımX satış danışmanı davetiniz",
    workshopId,
    templateKey: "sales_advisor_invite",
    audience: "internal",
    html: renderEmailLayout({
      heading: "Satış ekibine davet edildiniz",
      bodyHtml:
        `<p style="margin:0 0 12px;">Merhaba ${safeName},</p>` +
        `<p style="margin:0 0 12px;">BakımX Satış Paneli hesabınızı oluşturmak için aşağıdaki güvenli bağlantıyı kullanın.</p>` +
        `<p style="margin:0 0 12px;">Bağlantı 72 saat geçerlidir ve yalnız bir kez kullanılabilir.</p>`,
      cta: { label: "Şifremi belirle", url },
      footerNote: "Bu daveti beklemiyorsanız bağlantıyı kullanmayın.",
    }),
  })
}

async function issueInvite(input: {
  id?: string
  email: string
  firstName: string
  lastName: string
  actorUserId: string
}): Promise<Result> {
  const workshop = await internalWorkshop()
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  })
  if (existingUser) return { ok: false, error: "Bu e-posta zaten etkin bir BakımX hesabına bağlı." }

  const { token, tokenHash } = generateSalesAdvisorInviteToken()
  const expiresAt = salesAdvisorInviteExpiry()
  const invite = input.id
    ? await prisma.salesAdvisorInvite.update({
        where: { id: input.id },
        data: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          tokenHash,
          status: "pending",
          expiresAt,
          acceptedAt: null,
          createdByUserId: input.actorUserId,
        },
      })
    : await prisma.salesAdvisorInvite.upsert({
        where: { email: input.email },
        update: {
          firstName: input.firstName,
          lastName: input.lastName,
          tokenHash,
          status: "pending",
          expiresAt,
          acceptedAt: null,
          createdByUserId: input.actorUserId,
        },
        create: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          tokenHash,
          expiresAt,
          createdByUserId: input.actorUserId,
        },
      })

  const inviteUrl = buildSalesAdvisorInviteUrl(await requestOrigin(), token)
  const delivery = await deliverInvite(invite.email, invite.firstName, inviteUrl, workshop.id)
  await AuditLogAction(
    workshop.id,
    input.actorUserId,
    "SalesAdvisorInvite",
    invite.id,
    input.id ? "sales_advisor_invite_resent" : "sales_advisor_invite_sent",
    JSON.stringify({ email: invite.email, expiresAt: invite.expiresAt.toISOString(), delivered: delivery.ok }),
  ).catch((error) => {
    console.error("[sales-advisor-invite] delivery audit failed:", error)
  })
  revalidatePath("/admin/sales/advisors")
  return {
    ok: true,
    inviteUrl,
    warning: delivery.ok
      ? undefined
      : "Davet oluşturuldu ancak e-posta gönderilemedi. Bağlantıyı güvenli bir kanaldan paylaşın.",
  }
}

export async function inviteSalesAdvisor(input: unknown): Promise<Result> {
  const access = await getSalesAccess("manageSalesAdvisors")
  const parsed = salesAdvisorInviteSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Geçersiz davet bilgileri." }
  }
  return issueInvite({ ...parsed.data, actorUserId: access.userId })
}

export async function resendSalesAdvisorInvite(inviteId: string): Promise<Result> {
  const access = await getSalesAccess("manageSalesAdvisors")
  const invite = await prisma.salesAdvisorInvite.findUnique({ where: { id: inviteId } })
  if (!invite || invite.status === "accepted") {
    return { ok: false, error: "Bu davet yeniden gönderilemez." }
  }
  return issueInvite({
    id: invite.id,
    email: invite.email,
    firstName: invite.firstName,
    lastName: invite.lastName,
    actorUserId: access.userId,
  })
}

export async function setSalesAdvisorActive(advisorId: string, active: boolean): Promise<Result> {
  const access = await getSalesAccess("manageSalesAdvisors")
  const advisor = await prisma.salesAdvisor.findUnique({
    where: { id: advisorId },
    select: { id: true, userId: true, user: { select: { workshopId: true } } },
  })
  if (!advisor) return { ok: false, error: "Satış danışmanı bulunamadı." }

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.salesAdvisor.update({
      where: { id: advisor.id },
      data: { disabledAt: active ? null : now, sessionsValidFrom: now },
    })
    await tx.user.update({ where: { id: advisor.userId }, data: { isActive: active } })
    if (!active) {
      await tx.salesRegistrationLink.updateMany({
        where: { advisorId: advisor.id, usedAt: null, revokedAt: null },
        data: { revokedAt: now, revokedById: access.userId },
      })
    }
  })
  await AuditLogAction(
    advisor.user.workshopId,
    access.userId,
    "SalesAdvisor",
    advisor.id,
    active ? "sales_advisor_enabled" : "sales_advisor_disabled",
  )
  revalidatePath("/admin/sales/advisors")
  return { ok: true }
}

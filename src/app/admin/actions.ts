"use server"

import { revalidatePath } from "next/cache"
import { requireAdminCapability } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { isGatedFeature } from "@/lib/features"
import { computeTrialEnd, type PlanTier } from "@/lib/plan"
import { activateBillingOrder } from "@/lib/billing/activate"
import { activateVerifiedWorkshop } from "@/lib/billing/verify-activation"
import type { DemoRequestStatus, SupportRequestStatus } from "@prisma/client"
import { workshopApprovedEmail, workshopRejectedEmail } from "@/lib/emails/system-emails"
import { sendSystemEmail } from "@/lib/emails/send-system-email"
import { issuePasswordReset } from "@/lib/password-reset-delivery"
import {
  RESET_RESEND_COOLDOWN_MS,
  formatCooldownWait,
  resendCooldownRemainingMs,
} from "@/lib/password-reset"
import { canReceivePasswordReset } from "@/lib/user-identity"

type Result = { ok: true } | { ok: false; error: string }

/** İş yeri sahibine onay/red bildirimi gönderir. Best-effort — hata aksiyonu bozmaz.
 *  Alıcı: owner User'ın e-postası (yoksa workshop.email fallback). Tenant izolasyonu:
 *  sorgu workshopId ile sınırlı. */
async function sendOwnerDecisionEmail(
  workshopId: string,
  workshopName: string,
  fallbackEmail: string | null,
  decision: "approved" | "rejected",
): Promise<void> {
  try {
    const owner = await prisma.user.findFirst({
      where: { workshopId, role: "owner" },
      select: { email: true, firstName: true },
      orderBy: { createdAt: "asc" },
    })
    const to = owner?.email || fallbackEmail
    if (!to) return

    const built =
      decision === "approved"
        ? workshopApprovedEmail({ firstName: owner?.firstName || "", workshopName })
        : workshopRejectedEmail({ firstName: owner?.firstName || "", workshopName })

    await sendSystemEmail({
      to,
      subject: built.subject,
      html: built.html,
      workshopId,
      templateKey: decision === "approved" ? "workshop_approved" : "workshop_rejected",
      audience: "workshop",
    })
  } catch (err) {
    console.error("[admin] decision email failed:", err instanceof Error ? err.message : err)
  }
}

const TIERS: PlanTier[] = ["starter", "pro", "premium"]
const STATUSES = ["trialing", "active", "past_due", "canceled"] as const
type SubStatus = (typeof STATUSES)[number]

const DEMO_STATUSES: DemoRequestStatus[] = ["new", "contacted", "qualified", "converted", "archived"]
const SUPPORT_STATUSES: SupportRequestStatus[] = ["new", "in_progress", "resolved", "archived"]

/** Approve a workshop and (re)start its 7-day trial. Legacy / manual escape
 *  hatch: self sign-ups now flip to approved automatically when card
 *  verification succeeds (activateVerifiedWorkshop), so this is only reached to
 *  approve a `pending` row without a card (manual admin override) or to
 *  un-reject a previously rejected workshop. */
export async function approveWorkshop(workshopId: string): Promise<Result> {
  const ctx = await requireAdminCapability("manageWorkshops")
  if (!workshopId) return { ok: false, error: "İş yeri seçilmedi." }

  const now = new Date()
  const ws = await prisma.workshop.update({
    where: { id: workshopId },
    data: {
      approvalStatus: "approved",
      subscriptionStatus: "trialing",
      trialStartedAt: now,
      trialEndsAt: computeTrialEnd(now),
    },
  })
  await AuditLogAction(workshopId, ctx.user.id, "Workshop", workshopId, "admin_workshop_approved")
  await sendOwnerDecisionEmail(workshopId, ws.name, ws.email, "approved")
  revalidatePath("/admin", "layout")
  return { ok: true }
}

/** Reject a workshop (blocks sign-in). */
export async function rejectWorkshop(workshopId: string): Promise<Result> {
  const ctx = await requireAdminCapability("manageWorkshops")
  if (!workshopId) return { ok: false, error: "İş yeri seçilmedi." }

  const ws = await prisma.workshop.update({
    where: { id: workshopId },
    data: { approvalStatus: "rejected" },
  })
  await AuditLogAction(workshopId, ctx.user.id, "Workshop", workshopId, "admin_workshop_rejected")
  await sendOwnerDecisionEmail(workshopId, ws.name, ws.email, "rejected")
  revalidatePath("/admin", "layout")
  return { ok: true }
}

/** Activate a paid plan (fulfils any pending upgrade request). */
export async function activateWorkshopPlan(
  workshopId: string,
  tier: string,
  status: string = "active"
): Promise<Result> {
  const ctx = await requireAdminCapability("manageWorkshops")
  if (!workshopId) return { ok: false, error: "İş yeri seçilmedi." }
  if (!TIERS.includes(tier as PlanTier)) return { ok: false, error: "Geçersiz paket." }
  if (!STATUSES.includes(status as SubStatus)) return { ok: false, error: "Geçersiz durum." }

  await prisma.workshop.update({
    where: { id: workshopId },
    data: {
      planTier: tier as PlanTier,
      subscriptionStatus: status as SubStatus,
      approvalStatus: "approved",
      requestedPlanTier: null,
      planRequestedAt: null,
    },
  })
  await AuditLogAction(
    workshopId,
    ctx.user.id,
    "Workshop",
    workshopId,
    "admin_plan_activated",
    JSON.stringify({ tier, status })
  )
  revalidatePath("/admin", "layout")
  return { ok: true }
}

/** Grant/adjust founder-provided extra login seats (paid overage / custom deal). */
export async function setWorkshopExtraSeats(workshopId: string, extraSeats: number): Promise<Result> {
  const ctx = await requireAdminCapability("manageWorkshops")
  if (!workshopId) return { ok: false, error: "İş yeri seçilmedi." }
  if (!Number.isInteger(extraSeats) || extraSeats < 0 || extraSeats > 500) {
    return { ok: false, error: "Geçersiz ek koltuk sayısı." }
  }

  await prisma.workshop.update({ where: { id: workshopId }, data: { extraSeats } })
  await AuditLogAction(
    workshopId,
    ctx.user.id,
    "Workshop",
    workshopId,
    "admin_extra_seats_set",
    JSON.stringify({ extraSeats })
  )
  revalidatePath("/admin", "layout")
  return { ok: true }
}

/** Update the workflow status of a public demo request lead.
 *  No AuditLog — DemoRequest is not workshop-scoped; its `status`/`updatedAt`
 *  fields already track changes. AuditLog is workshop-bound and inappropriate
 *  for public leads. */
export async function updateDemoRequestStatus(
  requestId: string,
  status: string
): Promise<Result> {
  await requireAdminCapability("manageLeads")
  if (!requestId) return { ok: false, error: "Talep seçilmedi." }
  if (!DEMO_STATUSES.includes(status as DemoRequestStatus)) {
    return { ok: false, error: "Geçersiz durum." }
  }

  await prisma.demoRequest.update({
    where: { id: requestId },
    data: { status: status as DemoRequestStatus },
  })
  revalidatePath("/admin", "layout")
  return { ok: true }
}

/** İç notun konsolda okunabilir kalması için üst sınır; sınırsız metin
 *  denetim kaydını ve liste sorgusunu şişirir. */
const INTERNAL_NOTE_MAX = 2000

/** Destek talebi denetim kaydı — YALNIZ kiracıya bağlı talepler için.
 *  `AuditLog.workshopId` zorunlu olduğundan bağsız bir talebin düşecek yeri yok;
 *  bağlandığı anda sonraki her işlem kiracının denetim kaydında görünür. */
async function logSupportRequest(
  workshopId: string | null,
  actorUserId: string,
  requestId: string,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!workshopId) return
  await AuditLogAction(
    workshopId,
    actorUserId,
    "SupportRequest",
    requestId,
    action,
    metadata ? JSON.stringify(metadata) : undefined
  )
}

/** Update the workflow status of a public support request.
 *  Kiracıya bağlıysa AuditLog'a düşer (BAK-98); bağsız talepte `status`/`updatedAt`
 *  tek iz olarak kalır. */
export async function updateSupportRequestStatus(
  requestId: string,
  status: string
): Promise<Result> {
  const ctx = await requireAdminCapability("manageLeads")
  if (!requestId) return { ok: false, error: "Talep seçilmedi." }
  if (!SUPPORT_STATUSES.includes(status as SupportRequestStatus)) {
    return { ok: false, error: "Geçersiz durum." }
  }

  const updated = await prisma.supportRequest.update({
    where: { id: requestId },
    data: { status: status as SupportRequestStatus },
    select: { workshopId: true },
  })
  await logSupportRequest(updated.workshopId, ctx.user.id, requestId, "admin_support_request_status", {
    status,
  })
  revalidatePath("/admin", "layout")
  return { ok: true }
}

/** Şikayeti bir iş yerine bağla ya da bağı kaldır (boş `workshopId`).
 *  Denetim kaydı bağın DURDUĞU tarafa yazılır: bağlarken yeni kiracıya,
 *  bağı kaldırırken eski kiracıya — aksi hâlde işlem hiçbir yerde görünmezdi. */
export async function setSupportRequestWorkshop(
  requestId: string,
  workshopId: string
): Promise<Result> {
  const ctx = await requireAdminCapability("manageLeads")
  if (!requestId) return { ok: false, error: "Talep seçilmedi." }

  const nextWorkshopId = workshopId.trim() || null
  if (nextWorkshopId) {
    const exists = await prisma.workshop.findUnique({
      where: { id: nextWorkshopId },
      select: { id: true },
    })
    if (!exists) return { ok: false, error: "İş yeri bulunamadı." }
  }

  const current = await prisma.supportRequest.findUnique({
    where: { id: requestId },
    select: { workshopId: true },
  })
  if (!current) return { ok: false, error: "Talep bulunamadı." }

  await prisma.supportRequest.update({
    where: { id: requestId },
    data: { workshopId: nextWorkshopId },
  })
  await logSupportRequest(
    nextWorkshopId ?? current.workshopId,
    ctx.user.id,
    requestId,
    "admin_support_request_linked",
    { workshopId: nextWorkshopId }
  )
  revalidatePath("/admin", "layout")
  return { ok: true }
}

/** Talebi bir platform yöneticisine ata ya da atamayı kaldır (boş `userId`).
 *  Yalnız ETKİN yönetici atanabilir — pasif bir hesaba atanan talep sahipsiz
 *  kalırdı. */
export async function assignSupportRequest(requestId: string, userId: string): Promise<Result> {
  const ctx = await requireAdminCapability("manageLeads")
  if (!requestId) return { ok: false, error: "Talep seçilmedi." }

  const nextUserId = userId.trim() || null
  if (nextUserId) {
    const admin = await prisma.platformAdmin.findUnique({
      where: { userId: nextUserId },
      select: { disabledAt: true },
    })
    if (!admin || admin.disabledAt) {
      return { ok: false, error: "Yalnız etkin yöneticilere atama yapılabilir." }
    }
  }

  const updated = await prisma.supportRequest.update({
    where: { id: requestId },
    data: { assignedToUserId: nextUserId },
    select: { workshopId: true },
  })
  await logSupportRequest(
    updated.workshopId,
    ctx.user.id,
    requestId,
    "admin_support_request_assigned",
    { assignedToUserId: nextUserId }
  )
  revalidatePath("/admin", "layout")
  return { ok: true }
}

/** Konsol içi not. Metnin kendisi denetim kaydına YAZILMAZ — not serbest metin
 *  ve kişisel veri taşıyabilir; kaydın amacı "kim ne zaman düzenledi". */
export async function saveSupportRequestInternalNote(
  requestId: string,
  note: string
): Promise<Result> {
  const ctx = await requireAdminCapability("manageLeads")
  if (!requestId) return { ok: false, error: "Talep seçilmedi." }
  if (note.length > INTERNAL_NOTE_MAX) {
    return { ok: false, error: `Not en fazla ${INTERNAL_NOTE_MAX} karakter olabilir.` }
  }

  const trimmed = note.trim()
  const updated = await prisma.supportRequest.update({
    where: { id: requestId },
    data: { internalNote: trimmed || null },
    select: { workshopId: true },
  })
  await logSupportRequest(updated.workshopId, ctx.user.id, requestId, "admin_support_request_note", {
    cleared: trimmed.length === 0,
  })
  revalidatePath("/admin", "layout")
  return { ok: true }
}

/** Confirm a pending havale: activate the plan + set the paid period. Doubles
 *  as approval for public direct-purchase workshops. Thin wrapper — the
 *  actual claim-guard transaction lives in activateBillingOrder so the TAMI
 *  payment callback can share it. */
export async function confirmBillingOrder(orderId: string): Promise<Result> {
  const ctx = await requireAdminCapability("confirmBilling")
  if (!orderId) return { ok: false, error: "Sipariş seçilmedi." }

  // Sunucu tarafı guard (UI zaten kartlı siparişte butonu gizliyor ama tek
  // başına yeterli değil): kartlı sipariş yalnız otomatik callback ya da
  // takılı-ödeme retry'ı ile aktive olur. Elle confirm, banka çekimi sürerken
  // çifte aktivasyon riskidir.
  const order = await prisma.billingOrder.findUnique({
    where: { id: orderId },
    select: { method: true },
  })
  if (!order) return { ok: false, error: "Sipariş bulunamadı." }
  if (order.method === "card") {
    return {
      ok: false,
      error:
        "Kartlı siparişler otomatik onaylanır; elle onaylanamaz. Takılı ödeme için 'Aktivasyonu Tekrar Dene' kullanın.",
    }
  }

  const result = await activateBillingOrder(orderId, {
    actor: "admin",
    confirmedByEmail: ctx.user.email,
    actorUserId: ctx.user.id,
  })
  if (!result.ok) return result
  revalidatePath("/admin", "layout")
  return { ok: true }
}

/** Recover a card payment stuck at `callback_received` (bank captured the
 *  charge but activation never completed — see sweepStalePaymentArtifacts'
 *  founder alert). Reuses the exact same claim-guard transaction as the
 *  automated callback and the manual havale confirm, so this can never
 *  double-activate an already-confirmed order. */
export async function retryStuckActivation(transactionId: string): Promise<Result> {
  const ctx = await requireAdminCapability("confirmBilling")
  if (!transactionId) return { ok: false, error: "İşlem seçilmedi." }

  const txn = await prisma.paymentTransaction.findUnique({ where: { id: transactionId } })
  if (!txn) return { ok: false, error: "İşlem bulunamadı." }
  if (txn.status !== "callback_received") {
    return { ok: false, error: "Bu işlem kurtarma için uygun durumda değil." }
  }

  // Kart doğrulama denemelerinin (purpose=card_verification) siparişi yoktur —
  // ayrı bir dal: activateVerifiedWorkshop çağırır (claim-guard'lı, replay-safe).
  // Aynı "yalnız callback_received'dan completed'a" disiplinini korur.
  if (txn.purpose === "card_verification") {
    const activation = await activateVerifiedWorkshop(txn.workshopId)
    if (!activation.ok) {
      return { ok: false, error: "Doğrulama aktivasyonu başarısız oldu — tekrar deneyin." }
    }
    const claimed = await prisma.paymentTransaction.updateMany({
      where: { id: transactionId, status: "callback_received" },
      data: { status: "completed", completedAt: new Date() },
    })
    if (claimed.count > 0) {
      await AuditLogAction(
        txn.workshopId,
        ctx.user.id,
        "PaymentTransaction",
        transactionId,
        "payment_activation_retried",
        JSON.stringify({ purpose: "card_verification", result: "activated" })
      )
    }
    revalidatePath("/admin", "layout")
    return { ok: true }
  }

  if (!txn.billingOrderId) {
    return { ok: false, error: "Bu işlem bir siparişe bağlı değil — bu ekrandan kurtarılamıyor." }
  }

  const activation = await activateBillingOrder(txn.billingOrderId, {
    actor: "admin",
    confirmedByEmail: ctx.user.email,
    actorUserId: ctx.user.id,
  })

  if (activation.ok) {
    const claimed = await prisma.paymentTransaction.updateMany({
      where: { id: transactionId, status: "callback_received" },
      data: { status: "completed", completedAt: new Date() },
    })
    if (claimed.count > 0) {
      await AuditLogAction(
        txn.workshopId,
        ctx.user.id,
        "PaymentTransaction",
        transactionId,
        "payment_activation_retried",
        JSON.stringify({ billingOrderId: txn.billingOrderId, result: "activated" })
      )
    }
    revalidatePath("/admin", "layout")
    return { ok: true }
  }

  // "Bu sipariş zaten işlenmiş." → sipariş artık pending_payment DEĞİL. Bu iki
  // ÇOK farklı durumu kapsar; siparişin gerçek durumunu okuyup ayırıyoruz:
  //  - confirmed: başka bir yol (callback yarışı / önceki retry) aktive etmiş;
  //    para çekilmiş, plan açık → txn'i completed yapıp kapatabiliriz.
  //  - cancelled: sipariş iptal edilmiş ama txn hâlâ callback_received (yani
  //    para çekilmiş olabilir!). BUNU başarı sayıp completed'a çekmek, ödemesi
  //    alınıp aktive edilmemiş bir müşteriyi gizler. txn'e DOKUNMA, hatayı
  //    döndür, distinct bir audit satırı bırak (iade portaldan yapılmalı).
  if (activation.error === "Bu sipariş zaten işlenmiş.") {
    const order = await prisma.billingOrder.findUnique({
      where: { id: txn.billingOrderId },
      select: { status: true },
    })
    if (order?.status === "confirmed") {
      const claimed = await prisma.paymentTransaction.updateMany({
        where: { id: transactionId, status: "callback_received" },
        data: { status: "completed", completedAt: new Date() },
      })
      if (claimed.count > 0) {
        await AuditLogAction(
          txn.workshopId,
          ctx.user.id,
          "PaymentTransaction",
          transactionId,
          "payment_activation_retried",
          JSON.stringify({ billingOrderId: txn.billingOrderId, result: "already_confirmed" })
        )
      }
      revalidatePath("/admin", "layout")
      return { ok: true }
    }

    // İptal (veya beklenmedik başka bir durum): txn callback_received'da bırakılır.
    await AuditLogAction(
      txn.workshopId,
      ctx.user.id,
      "PaymentTransaction",
      transactionId,
      "payment_activation_retry_blocked",
      JSON.stringify({ billingOrderId: txn.billingOrderId, result: "order_cancelled", orderStatus: order?.status ?? "unknown" })
    )
    return {
      ok: false,
      error: "Sipariş iptal edilmiş — ödeme çekildiyse TAMI portalından iade gerekir.",
    }
  }

  // Any other failure (order missing, DB error): leave the txn untouched so
  // it stays visible in the stuck-transactions list for another attempt.
  return activation
}

/** Cancel a pending order (e.g. havale never arrived). */
export async function cancelBillingOrder(orderId: string): Promise<Result> {
  const ctx = await requireAdminCapability("confirmBilling")
  if (!orderId) return { ok: false, error: "Sipariş seçilmedi." }
  const order = await prisma.billingOrder.findUnique({ where: { id: orderId }, select: { id: true, status: true, workshopId: true, method: true } })
  if (!order) return { ok: false, error: "Sipariş bulunamadı." }
  if (order.status !== "pending_payment") return { ok: false, error: "Yalnızca bekleyen sipariş iptal edilebilir." }

  // Kartlı siparişte canlı bir ödeme denemesi (initiated / callback_received)
  // varken iptal etme: para çekilmiş olabilir. Önce ödemenin sonuçlanmasını
  // (veya sweep ile expired olmasını) bekle; aksi halde çekilmiş bir ödemeyi
  // iptal edilmiş bir siparişin arkasına saklamış oluruz.
  if (order.method === "card") {
    const liveTxn = await prisma.paymentTransaction.findFirst({
      where: { billingOrderId: orderId, status: { in: ["initiated", "callback_received"] } },
      select: { id: true },
    })
    if (liveTxn) {
      return {
        ok: false,
        error: "Canlı ödeme denemesi olan kartlı sipariş iptal edilemez. Önce ödemenin sonuçlanmasını bekleyin.",
      }
    }
  }

  const cancelled = await prisma.billingOrder.updateMany({
    where: { id: orderId, status: "pending_payment" },
    data: { status: "cancelled" },
  })
  if (cancelled.count === 0) return { ok: false, error: "Yalnızca bekleyen sipariş iptal edilebilir." }
  await AuditLogAction(order.workshopId, ctx.user.id, "BillingOrder", orderId, "billing_order_cancelled")
  revalidatePath("/admin", "layout")
  return { ok: true }
}

/**
 * Destek müdahalesi (BAK-97): kilitli kalmış bir kullanıcıya şifre sıfırlama
 * bağlantısı gönder.
 *
 * Üç sınır bilerek burada duruyor:
 *  1. **Bağlantı konsola DÖNMEZ.** Token'ı yalnız `issuePasswordReset` görür ve
 *     yalnız e-postaya yazar; ele geçirilmiş bir yönetici hesabı bu aksiyonla
 *     herhangi bir kiracı hesabına giremez.
 *  2. **Kiracı izolasyonu.** `userId` istemciden gelir, sorgu onu SUNUCUDA
 *     `workshopId` ile eşler; başka atölyenin kullanıcısı için token üretilemez.
 *  3. **Tekrar gönderim sınırı.** Son token'ın yaşı DB'den okunur. `rateLimit`
 *     BAK-116'dan beri paylaşımlı sayaç kullanıyor ama pencereleri dakikalık ve
 *     satırları süpürülebilir; token yaşı kalıcı kaydın kendisinden okunmalı.
 */
export async function sendUserPasswordReset(workshopId: string, userId: string): Promise<Result> {
  const ctx = await requireAdminCapability("sendPasswordReset")
  if (!workshopId || !userId) return { ok: false, error: "Kullanıcı seçilmedi." }

  const user = await prisma.user.findFirst({
    where: { id: userId, workshopId },
    select: { id: true, email: true, firstName: true, isActive: true, workshopId: true },
  })
  if (!user) return { ok: false, error: "Kullanıcı bu iş yerinde bulunamadı." }

  if (!canReceivePasswordReset(user) || !user.email) {
    return {
      ok: false,
      error: user.isActive
        ? "Bu hesabın e-postası yok. Şifresini iş yeri sahibi Ayarlar → Ekip'ten sıfırlar."
        : "Hesap pasif; önce iş yeri sahibi koltuğu yeniden etkinleştirmeli.",
    }
  }

  const lastToken = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, createdAt: { gte: new Date(Date.now() - RESET_RESEND_COOLDOWN_MS) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })
  const waitMs = resendCooldownRemainingMs(lastToken?.createdAt)
  if (waitMs > 0) {
    return {
      ok: false,
      error: `Bu kullanıcıya az önce bir bağlantı gönderildi. ${formatCooldownWait(waitMs)} sonra tekrar deneyin.`,
    }
  }

  const delivery = await issuePasswordReset(
    { id: user.id, email: user.email, firstName: user.firstName, workshopId: user.workshopId },
    { awaitDelivery: true },
  )

  // Denetim kaydı gönderim BAŞARISIZ olsa da yazılır: token üretilmiş ve
  // kullanıcının önceki bağlantıları geçersizlenmiştir — bu bir olaydır.
  await AuditLogAction(
    workshopId,
    ctx.user.id,
    "User",
    user.id,
    "password_reset_sent",
    JSON.stringify({ targetUserId: user.id, targetEmail: user.email, delivered: delivery.ok }),
  )

  if (!delivery.ok) {
    return { ok: false, error: "Bağlantı üretildi ama e-posta gönderilemedi. İletişim kayıtlarına bakın." }
  }

  revalidatePath(`/admin/workshops/${workshopId}`, "page")
  return { ok: true }
}

/** Set (upsert) a per-tenant feature override. `enabled` forces the feature on/off
 *  for this workshop regardless of plan tier (resolveFeature composes with this).
 *  Optional ISO `expiresAt` auto-expires the grant (e.g. time-boxed beta). */
export async function setWorkshopFeatureOverride(
  workshopId: string,
  featureKey: string,
  enabled: boolean,
  expiresAtIso?: string | null,
): Promise<Result> {
  const ctx = await requireAdminCapability("manageFlags")
  if (!workshopId) return { ok: false, error: "İş yeri seçilmedi." }
  if (!isGatedFeature(featureKey)) return { ok: false, error: "Geçersiz özellik." }

  let expiresAt: Date | null = null
  if (expiresAtIso) {
    const d = new Date(expiresAtIso)
    if (Number.isNaN(d.getTime())) return { ok: false, error: "Geçersiz bitiş tarihi." }
    expiresAt = d
  }

  await prisma.workshopFeatureOverride.upsert({
    where: { workshopId_featureKey: { workshopId, featureKey } },
    create: { workshopId, featureKey, enabled, expiresAt, createdBy: ctx.user.id },
    update: { enabled, expiresAt, createdBy: ctx.user.id },
  })
  await AuditLogAction(
    workshopId,
    ctx.user.id,
    "WorkshopFeatureOverride",
    featureKey,
    "feature_override_set",
    JSON.stringify({ featureKey, enabled, expiresAt: expiresAt?.toISOString() ?? null }),
  )
  revalidatePath("/admin", "layout")
  return { ok: true }
}

/** Remove a per-tenant override → the feature falls back to the plan tier. */
export async function clearWorkshopFeatureOverride(
  workshopId: string,
  featureKey: string,
): Promise<Result> {
  const ctx = await requireAdminCapability("manageFlags")
  if (!workshopId) return { ok: false, error: "İş yeri seçilmedi." }
  if (!isGatedFeature(featureKey)) return { ok: false, error: "Geçersiz özellik." }

  await prisma.workshopFeatureOverride.deleteMany({ where: { workshopId, featureKey } })
  await AuditLogAction(
    workshopId,
    ctx.user.id,
    "WorkshopFeatureOverride",
    featureKey,
    "feature_override_cleared",
    JSON.stringify({ featureKey }),
  )
  revalidatePath("/admin", "layout")
  return { ok: true }
}

/** Atölyenin BakımX ürün iskontosunu ayarla (BAK-47). */
export async function updateWorkshopBakimxDiscount(
  workshopId: string,
  discountBps: number,
): Promise<Result> {
  const ctx = await requireAdminCapability("manageWorkshops")
  if (!workshopId) return { ok: false, error: "İş yeri seçilmedi." }
  if (!Number.isInteger(discountBps) || discountBps < 0 || discountBps > 10000) {
    return { ok: false, error: "İskonto 0-10000 bps aralığında olmalıdır." }
  }

  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: { bakimxDiscountBps: true },
  })
  if (!workshop) return { ok: false, error: "İş yeri bulunamadı." }

  const oldValue = workshop.bakimxDiscountBps
  await prisma.workshop.update({
    where: { id: workshopId },
    data: { bakimxDiscountBps: discountBps },
  })

  await AuditLogAction(
    workshopId,
    ctx.user.id,
    "Workshop",
    workshopId,
    "workshop_bakimx_discount_updated",
    JSON.stringify({ beforeBps: oldValue, afterBps: discountBps }),
  )

  revalidatePath(`/admin/workshops/${workshopId}`, "page")
  return { ok: true }
}

import { prisma } from "@/lib/db"
import { getPlanState } from "@/lib/plan"
import { getPlanPackage } from "@/lib/plans-catalog"
import { getAdminEmails } from "@/lib/admin"
import { sendSystemEmail } from "@/lib/emails/send-system-email"
import { trialExpiryWarningEmail, subscriptionExpiryWarningEmail, founderAlertEmail } from "@/lib/emails/system-emails"

const DAY_MS = 86_400_000
const HOUR_MS = 60 * 60 * 1000

/** Deneme uyarı eşikleri (gün), büyükten küçüğe. Tarihsiz — trial tek pencere. */
export const TRIAL_WARNING_THRESHOLDS = [3, 1, 0]
/** Abonelik uyarı eşikleri (gün), büyükten küçüğe. */
export const SUBSCRIPTION_WARNING_THRESHOLDS = [7, 3, 1, 0]

/** Çok eski (>7g) hesapları süpürmeye hiç almamak için pencere — t0 zaten
 *  dedup'lu ama bu filtre eski/terk edilmiş kayıtları sorgudan tamamen dışlar. */
const SWEEP_LOOKBACK_MS = 7 * DAY_MS

export interface LifecycleSweepResult {
  processed: number
  sent: number
  failed: number
  errors: string[]
}

function newResult(): LifecycleSweepResult {
  return { processed: 0, sent: 0, failed: 0, errors: [] }
}

/**
 * Saf çekirdek: hangi uyarı eşiğinin (varsa) gönderilmesi gerektiğini seçer.
 *
 * Kural: eşikler büyükten küçüğe verilir (ör. trial [3,1,0]). `daysLeft <= t`
 * koşulunu sağlayan eşikler arasından EN KÜÇÜK olanı (en acil/en yakın zamanlı
 * olanı) aday seçilir. O aday zaten gönderilmişse null döner — FALL-THROUGH
 * YOKTUR: daha büyük bir eşiğe geri düşülmez (çalışma başına workshop başına
 * en fazla 1 uyarı).
 *
 * "Kaçırılan gün" senaryosu bu şekilde doğal olarak ele alınır: cron bir gün
 * çalışmazsa (ör. daysLeft tam 3 iken atlanır, ertesi gün daysLeft=2 olur),
 * `daysLeft <= t` (== değil) sayesinde t=3 hâlâ aday olarak seçilir ve t3
 * key'iyle geç de olsa gönderilir.
 */
export function pickWarningThreshold(
  daysLeft: number,
  sentThresholds: ReadonlySet<number>,
  thresholds: readonly number[],
): number | null {
  const eligible = thresholds.filter((t) => daysLeft <= t)
  if (eligible.length === 0) return null
  const target = Math.min(...eligible)
  if (sentThresholds.has(target)) return null
  return target
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Trial uyarı anahtarına trial penceresi (trialEndsAt) gömülür — approveWorkshop
 *  (un-reject) bir workshop'u yeni bir trialEndsAt ile tekrar trialing'e
 *  sokabildiği için tarihsiz anahtar ikinci trial'da uyarıları susturur; dönem
 *  gömülü anahtar abonelik desenindeki gibi doğal resetlenir. */
export function trialTemplateKey(threshold: number, trialEndsAt: Date): string {
  return `trial_expiry_t${threshold}:${dateKey(trialEndsAt)}`
}

/** Abonelik uyarı anahtarına dönem bitiş tarihi gömülür — bir sonraki
 *  yenilemede (yeni currentPeriodEnd ile) dedup doğal olarak resetlenir. */
export function subscriptionTemplateKey(threshold: number, currentPeriodEnd: Date): string {
  return `sub_expiry_t${threshold}:${dateKey(currentPeriodEnd)}`
}

/** Bir workshop için verilen templateKey adaylarından hangilerinin daha önce
 *  BAŞARIYLA (status "sent") gönderildiğini CommunicationLog'dan okur. */
async function fetchSentTemplateKeys(workshopId: string, templateKeys: string[]): Promise<Set<string>> {
  if (templateKeys.length === 0) return new Set()
  const rows = await prisma.communicationLog.findMany({
    where: { workshopId, type: "email", status: "sent", templateKey: { in: templateKeys } },
    select: { templateKey: true },
  })
  return new Set(rows.map((r) => r.templateKey).filter((k): k is string => k != null))
}

/** Workshop sahibinin e-posta adresini çözer — admin/actions.ts'teki
 *  sendOwnerDecisionEmail ile birebir aynı yol: önce role="owner" User, yoksa
 *  workshop.email fallback. */
async function resolveOwnerEmail(
  workshopId: string,
  fallbackEmail: string | null,
): Promise<{ email: string | null; firstName: string }> {
  const owner = await prisma.user.findFirst({
    where: { workshopId, role: "owner" },
    select: { email: true, firstName: true },
    orderBy: { createdAt: "asc" },
  })
  return { email: owner?.email || fallbackEmail, firstName: owner?.firstName || "" }
}

type TrialWorkshop = {
  id: string
  name: string
  email: string | null
  planTier: "starter" | "pro" | "premium"
  subscriptionStatus: "trialing" | "active" | "past_due" | "canceled"
  approvalStatus: "pending" | "approved" | "rejected"
  trialEndsAt: Date | null
  currentPeriodEnd: Date | null
}

/** Deneme süresi bitişine yaklaşan (T-3/T-1) ve biten (T-0) workshoplara uyarı
 *  gönderir. Kaç workshop işlendi/gönderildi/başarısız oldu sayaçlarını döner. */
export async function sweepTrialWarnings(): Promise<LifecycleSweepResult> {
  const result = newResult()
  const now = new Date()
  const notTooOld = new Date(now.getTime() - SWEEP_LOOKBACK_MS)

  const workshops = await prisma.workshop.findMany({
    where: {
      subscriptionStatus: "trialing",
      approvalStatus: "approved",
      trialEndsAt: { not: null, gt: notTooOld },
    },
    select: {
      id: true,
      name: true,
      email: true,
      planTier: true,
      subscriptionStatus: true,
      approvalStatus: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
    },
  })

  for (const workshop of workshops as TrialWorkshop[]) {
    result.processed++
    try {
      const state = getPlanState(workshop)
      if (state.trialDaysLeft == null || workshop.trialEndsAt == null) continue

      const trialEndsAt = workshop.trialEndsAt
      const candidateKeys = TRIAL_WARNING_THRESHOLDS.map((t) => trialTemplateKey(t, trialEndsAt))
      const sentKeys = await fetchSentTemplateKeys(workshop.id, candidateKeys)
      const sentThresholds = new Set(
        TRIAL_WARNING_THRESHOLDS.filter((t) => sentKeys.has(trialTemplateKey(t, trialEndsAt))),
      )

      const threshold = pickWarningThreshold(state.trialDaysLeft, sentThresholds, TRIAL_WARNING_THRESHOLDS)
      if (threshold == null) continue

      const { email, firstName } = await resolveOwnerEmail(workshop.id, workshop.email)
      if (!email) continue

      const built = trialExpiryWarningEmail({
        ownerName: firstName,
        workshopName: workshop.name,
        daysLeft: state.trialDaysLeft,
        trialEndsAt: workshop.trialEndsAt,
      })
      const sendResult = await sendSystemEmail({
        to: email,
        subject: built.subject,
        html: built.html,
        workshopId: workshop.id,
        templateKey: trialTemplateKey(threshold, trialEndsAt),
      })
      if (sendResult.ok) result.sent++
      else result.failed++
    } catch (error) {
      result.failed++
      result.errors.push(`Workshop ${workshop.id}: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`)
    }
  }

  return result
}

type SubscriptionWorkshop = TrialWorkshop

/** Aktif abonelik dönemi bitişine yaklaşan (T-7/T-3/T-1) ve biten (T-0)
 *  workshoplara uyarı gönderir. */
export async function sweepSubscriptionWarnings(): Promise<LifecycleSweepResult> {
  const result = newResult()
  const now = new Date()
  const notTooOld = new Date(now.getTime() - SWEEP_LOOKBACK_MS)

  const workshops = await prisma.workshop.findMany({
    where: {
      subscriptionStatus: "active",
      currentPeriodEnd: { not: null, gt: notTooOld },
    },
    select: {
      id: true,
      name: true,
      email: true,
      planTier: true,
      subscriptionStatus: true,
      approvalStatus: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
    },
  })

  for (const workshop of workshops as SubscriptionWorkshop[]) {
    result.processed++
    try {
      const state = getPlanState(workshop)
      if (state.subscriptionDaysLeft == null || workshop.currentPeriodEnd == null) continue

      const currentPeriodEnd = workshop.currentPeriodEnd
      const candidateKeys = SUBSCRIPTION_WARNING_THRESHOLDS.map((t) => subscriptionTemplateKey(t, currentPeriodEnd))
      const sentKeys = await fetchSentTemplateKeys(workshop.id, candidateKeys)
      const sentThresholds = new Set(
        SUBSCRIPTION_WARNING_THRESHOLDS.filter((t) => sentKeys.has(subscriptionTemplateKey(t, currentPeriodEnd))),
      )

      const threshold = pickWarningThreshold(
        state.subscriptionDaysLeft,
        sentThresholds,
        SUBSCRIPTION_WARNING_THRESHOLDS,
      )
      if (threshold == null) continue

      const { email, firstName } = await resolveOwnerEmail(workshop.id, workshop.email)
      if (!email) continue

      const planLabel = getPlanPackage(workshop.planTier)?.name ?? workshop.planTier
      const built = subscriptionExpiryWarningEmail({
        ownerName: firstName,
        workshopName: workshop.name,
        daysLeft: state.subscriptionDaysLeft,
        currentPeriodEnd,
        planTier: planLabel,
      })
      const sendResult = await sendSystemEmail({
        to: email,
        subject: built.subject,
        html: built.html,
        workshopId: workshop.id,
        templateKey: subscriptionTemplateKey(threshold, currentPeriodEnd),
      })
      if (sendResult.ok) result.sent++
      else result.failed++
    } catch (error) {
      result.failed++
      result.errors.push(`Workshop ${workshop.id}: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`)
    }
  }

  return result
}

/** Bir ödeme denemesinin hâlâ "canlı" sayıldığı durumlar — bu durumdaki bir
 *  transaction'ı olan sipariş ASLA iptal edilmez (banka çekimi sürüyor olabilir). */
const NON_TERMINAL_TXN_STATUSES = new Set(["initiated", "callback_received"])

/** Son ödeme denemesinden sonra siparişi ayakta tutma penceresi: terminal
 *  (failed/expired) bir deneme bile 24 saatten yeniyse kullanıcı aktif demektir. */
const RECENT_TXN_GRACE_MS = 24 * HOUR_MS

/**
 * Saf çekirdek: eski bir kart siparişinin (pending_payment) iptal edilip
 * edilemeyeceğine karar verir. İptal YALNIZ şu üç koşul birlikte sağlanınca:
 *  1. Sipariş 7 günden eski (createdAt < now - 7g),
 *  2. Hiçbir transaction'ı non-terminal (initiated/callback_received) durumda
 *     DEĞİL — kullanıcı eski sipariş üzerinde ödemeyi her an yeniden
 *     deneyebilir; cron tam banka çekimi sırasında siparişi iptal ederse
 *     activateBillingOrder claim-guard'ı "zaten işlenmiş" der → para çekilir
 *     ama plan asla aktive olmaz (iptal edilmiş sipariş diriltilemez),
 *  3. En son transaction'ı (varsa) 24 saatten eski.
 */
export function shouldCancelStaleOrder(
  order: { createdAt: Date },
  txns: ReadonlyArray<{ status: string; createdAt: Date }>,
  now: Date,
): boolean {
  if (order.createdAt.getTime() >= now.getTime() - SWEEP_LOOKBACK_MS) return false
  if (txns.some((t) => NON_TERMINAL_TXN_STATUSES.has(t.status))) return false
  const latestTxnAt = txns.reduce((max, t) => Math.max(max, t.createdAt.getTime()), 0)
  if (latestTxnAt >= now.getTime() - RECENT_TXN_GRACE_MS) return false
  return true
}

/** Founder alert'i tek bir stuck transaction için en fazla bir kez gönderir
 *  (dedup: CommunicationLog'da templateKey `stuck_txn_alert:<txnId>` + status
 *  "sent" var mı diye önceden kontrol edilir — sendSystemEmail zaten loglar). */
async function alertStuckTransactionOnce(txn: { id: string; workshopId: string }, detail: string): Promise<boolean> {
  const templateKey = `stuck_txn_alert:${txn.id}`
  const existing = await prisma.communicationLog.findFirst({
    where: { workshopId: txn.workshopId, type: "email", status: "sent", templateKey },
    select: { id: true },
  })
  if (existing) return false

  const to = getAdminEmails()
  if (to.length === 0) return false

  const built = founderAlertEmail({ title: "Takılı ödeme işlemi", detail })
  const result = await sendSystemEmail({
    to: to.join(","),
    subject: built.subject,
    html: built.html,
    workshopId: txn.workshopId,
    templateKey,
  })
  return result.ok
}

/**
 * Bakım süpürmeleri:
 *  (a) initiated durumunda 2 saatten eski PaymentTransaction'lar → expired
 *  (b) card yöntemiyle pending_payment durumunda 7 günden eski BillingOrder'lar
 *      → cancelled (kart akışında ödeme tamamlanmadıysa sipariş asılı kalmasın)
 *  (c) callback_received durumunda 1 saatten eski PaymentTransaction'lar → para
 *      çekilmiş olabilir ama aktivasyon takılı kalmış olabilir; founder alert
 *      (workshop/transaction başına en fazla bir kez).
 */
export async function sweepStalePaymentArtifacts(): Promise<LifecycleSweepResult> {
  const result = newResult()
  const now = new Date()

  // (a) initiated → expired
  try {
    const staleInitiatedCutoff = new Date(now.getTime() - 2 * HOUR_MS)
    const expired = await prisma.paymentTransaction.updateMany({
      where: { status: "initiated", createdAt: { lt: staleInitiatedCutoff } },
      data: { status: "expired" },
    })
    result.processed += expired.count
    result.sent += expired.count
  } catch (error) {
    result.failed++
    result.errors.push(`stale-initiated: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`)
  }

  // (b) card + pending_payment → cancelled — YALNIZ canlı ödeme denemesi
  // olmayan siparişler (bkz. shouldCancelStaleOrder): kullanıcı eski sipariş
  // üzerinde ödemeyi yeniden deneyebilir; aktif/yeni denemesi olan siparişi
  // iptal etmek "para çekildi ama plan aktive olmadı" felaketine yol açar.
  try {
    const stalePendingCutoff = new Date(now.getTime() - SWEEP_LOOKBACK_MS)
    const candidates = await prisma.billingOrder.findMany({
      where: { method: "card", status: "pending_payment", createdAt: { lt: stalePendingCutoff } },
      select: {
        id: true,
        createdAt: true,
        // purpose: "purchase" — açıklık için: bu ilişki zaten yalnız billingOrderId
        // dolu (purchase) txn'leri döner, ama doğrulama denemeleri süpürmeye asla
        // karışmasın diye niyet burada da açıkça filtrelenir.
        paymentTransactions: { where: { purpose: "purchase" }, select: { status: true, createdAt: true } },
      },
    })
    const cancellableIds = candidates
      .filter((order) => shouldCancelStaleOrder(order, order.paymentTransactions, now))
      .map((order) => order.id)
    result.processed += candidates.length
    if (cancellableIds.length > 0) {
      // status guardı where'de tekrarlanır: aday okuması ile update arasında
      // sipariş onaylanmışsa (yarış) yine de iptal edilmesin.
      const cancelled = await prisma.billingOrder.updateMany({
        where: { id: { in: cancellableIds }, status: "pending_payment" },
        data: { status: "cancelled" },
      })
      result.sent += cancelled.count
    }
  } catch (error) {
    result.failed++
    result.errors.push(`stale-pending-order: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`)
  }

  // (c) callback_received stuck → founder alert (dedup per transaction)
  try {
    const stuckCutoff = new Date(now.getTime() - HOUR_MS)
    const stuckTxns = await prisma.paymentTransaction.findMany({
      where: { status: "callback_received", createdAt: { lt: stuckCutoff } },
      select: { id: true, workshopId: true, providerOrderId: true, createdAt: true },
    })
    for (const txn of stuckTxns) {
      result.processed++
      try {
        const alerted = await alertStuckTransactionOnce(
          txn,
          `İşlem ${txn.providerOrderId} (workshop ${txn.workshopId}) ${txn.createdAt.toISOString()} tarihinden beri "callback_received" durumunda takılı kaldı. Para çekilmiş olabilir; aktivasyon gerçekleşmemiş olabilir. Manuel kontrol gerekli.`,
        )
        if (alerted) result.sent++
      } catch (error) {
        result.failed++
        result.errors.push(`stuck-txn ${txn.id}: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`)
      }
    }
  } catch (error) {
    result.failed++
    result.errors.push(`stuck-txn-query: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`)
  }

  return result
}

/** Kart doğrulaması hiç yayına girmeden önce (legacy) yaratılmış pending
 *  workshoplar süpürmeye ASLA dahil edilmez — bu tarihten sonra yaratılan
 *  workshoplar kart-doğrulama gate'ine tabidir, öncekiler farklı (admin
 *  onaylı) bir akıştan gelir ve gerçek başvuru olabilir. */
const PURGE_LEGACY_CUTOFF = new Date("2026-07-07T00:00:00Z")
/** Doğrulanmamış bir kaydın "terk edilmiş" sayılması için geçmesi gereken süre. */
const PURGE_STALE_MS = 48 * HOUR_MS

export interface PurgeCandidateWorkshop {
  approvalStatus: string
  trialStartedAt: Date | null
  createdAt: Date
  billingOrderCount: number
  serviceOrderCount: number
  /** Canlı (initiated/callback_received) card_verification txn sayısı —
   *  bkz. kural 6. */
  liveVerificationTxnCount: number
}

/**
 * Saf çekirdek: bir workshop'un "doğrulamasız terk edilmiş kayıt" olarak
 * SİLİNİP silinemeyeceğine karar verir — bu bir DELETE'in güvenlik sınırıdır,
 * yalnız TÜMÜ birden sağlanınca true döner:
 *  1. approvalStatus hâlâ "pending" (asla approved/rejected bir workshop'a dokunma),
 *  2. trialStartedAt null (kart doğrulaması hiç tamamlanmamış — dolayısıyla
 *     activateVerifiedWorkshop asla çalışmamış),
 *  3. createdAt >= PURGE_LEGACY_CUTOFF (özellik yayınından SONRA yaratılmış —
 *     legacy/admin-akışlı pending kayıtlar asla süpürülmez),
 *  4. createdAt en az 48 saat önce (kullanıcıya kart adımını tamamlaması için
 *     makul süre tanınır; taze kayıtlar dokunulmaz),
 *  5. billingOrderCount === 0 VE serviceOrderCount === 0 (herhangi bir iz
 *     bırakmış workshop ASLA silinmez — bu imkansız olmalı zira pending
 *     workshoplar uygulamaya erişemez, ama çift güvenlik),
 *  6. liveVerificationTxnCount === 0 — canlı (initiated/callback_received)
 *     doğrulama denemesi olan workshop ASLA silinmez: callback_received'da
 *     takılı bir txn "1 TL çekilmiş ama aktivasyon tamamlanmamış" demektir;
 *     retryStuckActivation tam bu satırı kurtarmak için var. Silmek banka
 *     blokesini sahipsiz bırakır VE kurtarılacak kanıt satırını yok eder.
 *     (initiated txn'ler zaten 2 saatte expired'a süpürülür — bu guard
 *     yalnız kısa süreli, callback_received içinse kalıcı koruma sağlar.)
 */
export function shouldPurgeUnverifiedWorkshop(w: PurgeCandidateWorkshop, now: Date): boolean {
  if (w.approvalStatus !== "pending") return false
  if (w.trialStartedAt !== null) return false
  if (w.createdAt.getTime() < PURGE_LEGACY_CUTOFF.getTime()) return false
  if (w.billingOrderCount > 0 || w.serviceOrderCount > 0) return false
  if (w.liveVerificationTxnCount > 0) return false
  return now.getTime() - w.createdAt.getTime() >= PURGE_STALE_MS
}

/**
 * Kart doğrulamasını hiç tamamlamamış, 48 saatten eski, terk edilmiş
 * self-serve kayıtları siler (DB temizliği — kalıcı e-posta rezervasyonu
 * bırakmasın diye). Yalnız gerçekten dokunulmamış (sıfır sipariş/iş emri,
 * sıfır CANLI doğrulama denemesi — takılı 1 TL bloke kurtarılabilir kalmalı)
 * workshoplar hedeflenir; şüpheli bir satır bulunsa bile o workshop
 * ATLANIR (silme değil, sonraki turda tekrar değerlendirilir).
 *
 * Silme sırası FK'lere uyar (çocuktan ebeveyne): PaymentTransaction (denormalize
 * workshopId, gerçek FK yok ama tutarlılık için) → CommunicationLog → AuditLog →
 * WorkshopFeatureOverride → Invite (User'a da FK'li, User'dan ÖNCE silinir) →
 * WorkshopSettings → User → Workshop. schema.prisma'daki Workshop'a FK'li ~30
 * diğer model (Customer/Vehicle/ServiceOrder/...) uygulamaya erişim gerektirir;
 * pending+doğrulamasız bir workshop hiçbir zaman bu tabloları dolduramaz
 * (approval gate uygulamayı kilitler) — yine de beklenmedik bir FK çakışması
 * olursa o workshop'un silinmesi try/catch ile başarısız sayılıp atlanır,
 * tüm süpürme ÇÖKMEZ.
 */
export async function sweepUnverifiedRegistrations(): Promise<LifecycleSweepResult> {
  const result = newResult()
  const now = new Date()
  const staleCutoff = new Date(now.getTime() - PURGE_STALE_MS)

  // Aday + canlı-txn sorguları try/catch'te (sweepStalePaymentArtifacts
  // deseniyle tutarlı): sorgu hatası tüm billing cron'unu düşürmesin —
  // diğer süpürmelerin sayaçları yine kaydedilir.
  let candidates: Array<{
    id: string
    email: string | null
    approvalStatus: string
    trialStartedAt: Date | null
    createdAt: Date
    _count: { billingOrders: number; orders: number }
  }>
  let liveVerifyTxnCountByWorkshopId: Map<string, number>
  try {
    candidates = await prisma.workshop.findMany({
      where: {
        approvalStatus: "pending",
        trialStartedAt: null,
        createdAt: { gte: PURGE_LEGACY_CUTOFF, lt: staleCutoff },
      },
      select: {
        id: true,
        email: true,
        approvalStatus: true,
        trialStartedAt: true,
        createdAt: true,
        _count: { select: { billingOrders: true, orders: true } },
      },
    })

    // PaymentTransaction.workshopId denormalize (Workshop'ta ters relation yok)
    // → canlı doğrulama denemeleri ikinci bir sorguyla sayılır. Saf filtredeki
    // kural 6'nın DB tarafı: canlı txn'i olan aday hiçbir koşulda silinmez.
    const liveVerifyTxns = candidates.length
      ? await prisma.paymentTransaction.groupBy({
          by: ["workshopId"],
          where: {
            workshopId: { in: candidates.map((w) => w.id) },
            purpose: "card_verification",
            status: { in: ["initiated", "callback_received"] },
          },
          _count: { _all: true },
        })
      : []
    liveVerifyTxnCountByWorkshopId = new Map(liveVerifyTxns.map((t) => [t.workshopId, t._count._all]))
  } catch (error) {
    result.failed++
    result.errors.push(`purge-query: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`)
    return result
  }

  for (const w of candidates) {
    result.processed++
    const eligible = shouldPurgeUnverifiedWorkshop(
      {
        approvalStatus: w.approvalStatus,
        trialStartedAt: w.trialStartedAt,
        createdAt: w.createdAt,
        billingOrderCount: w._count.billingOrders,
        serviceOrderCount: w._count.orders,
        liveVerificationTxnCount: liveVerifyTxnCountByWorkshopId.get(w.id) ?? 0,
      },
      now,
    )
    if (!eligible) continue

    try {
      // İnteraktif transaction: canlı doğrulama denemesi transaction İÇİNDE bir
      // kez daha sayılır — aday sorgusu ile silme arasında kullanıcı pending
      // kilit ekranından yeni bir doğrulama başlatmış olabilir (yarış). Canlı
      // txn görülürse silme atlanır (deleted=false), workshop sonraki turda
      // tekrar değerlendirilir.
      const deleted = await prisma.$transaction(async (tx) => {
        const liveNow = await tx.paymentTransaction.count({
          where: {
            workshopId: w.id,
            purpose: "card_verification",
            status: { in: ["initiated", "callback_received"] },
          },
        })
        if (liveNow > 0) return false

        await tx.paymentTransaction.deleteMany({ where: { workshopId: w.id } })
        await tx.communicationLog.deleteMany({ where: { workshopId: w.id } })
        await tx.auditLog.deleteMany({ where: { workshopId: w.id } })
        await tx.workshopFeatureOverride.deleteMany({ where: { workshopId: w.id } })
        await tx.invite.deleteMany({ where: { workshopId: w.id } })
        await tx.workshopSettings.deleteMany({ where: { workshopId: w.id } })
        await tx.user.deleteMany({ where: { workshopId: w.id } })
        await tx.workshop.delete({ where: { id: w.id } })
        return true
      })
      if (!deleted) continue
      result.sent++
      console.info(`[sweepUnverifiedRegistrations] silindi: workshopId=${w.id} email=${w.email ?? "—"}`)
    } catch (error) {
      result.failed++
      result.errors.push(`purge ${w.id}: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`)
    }
  }

  return result
}

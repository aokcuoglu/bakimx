import { hasLifetimeLite } from "@/lib/lite-campaign"
import type { Workshop } from "@prisma/client"

/**
 * Plan / subscription / trial logic for the SaaS access model.
 *
 * Two orthogonal gates exist:
 *  - approvalStatus: e-mail-verification gate. Self sign-ups (/register) create a
 *    `pending` workshop with NO trial; the workshop flips to `approved` and its
 *    7-business-day trial starts only when e-mail verification succeeds
 *    (activateVerifiedWorkshop). Pending users CAN sign in — they land on the
 *    full-screen PlanLocked verify screen ((app)/layout.tsx). `rejected` is the
 *    admin kill switch (blocks login entirely); admin approveWorkshop remains a
 *    legacy/manual escape hatch.
 *  - subscriptionStatus + trialEndsAt: billing/trial lifecycle
 *
 * Enforcement layers:
 *  - `canWrite` / `assertWriteAccess` (via requireWritableWorkshop) is the
 *    SERVER-SIDE enforcement: every mutating server action / API route must be
 *    blocked when ANY lockReason is set — pending/rejected included, since a
 *    pending session could otherwise call actions/APIs directly with its
 *    cookie and use the app without ever verifying its e-mail address.
 *  - `hasAccess` + PlanLocked ((app)/layout.tsx) is the UX layer: full-screen
 *    lock for pending/rejected. Plan-EXPIRY reasons (see
 *    {@link isPlanExpiredLock}) are a hard paywall instead: (app)/layout.tsx
 *    signs the session out and login lands the workshop on /checkout. The old
 *    read-only mode (data visible, writes blocked) now only survives for
 *    founder impersonation, so a locked tenant can still be inspected.
 *
 * Per-feature gating (#782 — tek paket):
 *  - Satışta tek paket var: `pro` = "Servis Paketi". Paket servis yönetimi için
 *    gereken her şeyi içerir (plaka okuma dahil).
 *  - {@link ADDON_FEATURES} pakete DAHİL DEĞİLDİR; ileride uygulama içinden ek
 *    özellik olarak satılacak. Bugün yalnız `premium` erişim profili ("Paket +
 *    ek özellikler") onları açar — deneme bu profile çözülür
 *    ({@link TRIAL_ACCESS_TIER}), admin de elle verebilir.
 *  - `lite` / `starter` / `premium` satışa kapalıdır ama mevcut satırlar
 *    okunur kalır (enum/tip kırılmaz).
 *  - `assertFeature` (throw-based) is ready to adopt inside server actions.
 *  - `eInvoice`: planned gate on e-Fatura issuance when the integration lands.
 *  - `multiBranch`: gate on branch creation (`canCreateBranch`).
 *  - `rbac`: defined for completeness; today RBAC roles (owner/manager/staff)
 *    are available across all tiers, so the gate is informational only.
 */

export const TRIAL_BUSINESS_DAYS = 7
const DAY_MS = 86_400_000
const ISTANBUL_WEEKDAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Istanbul",
  weekday: "short",
})

function isBusinessDay(date: Date): boolean {
  const weekday = ISTANBUL_WEEKDAY.format(date)
  return weekday !== "Sat" && weekday !== "Sun"
}

/** Cumartesi/pazar günlerini saymadan başlangıçtan sonraki iş günlerini sayar. */
export function businessDaysUntil(from: Date, until: Date): number {
  if (until.getTime() <= from.getTime()) return 0

  let count = 0
  const cursor = new Date(from)
  while (true) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    if (cursor.getTime() > until.getTime()) break
    if (isBusinessDay(cursor)) count += 1
  }
  return count
}

export const PLAN_TIERS = ["lite", "starter", "pro", "premium"] as const
export type PlanTier = (typeof PLAN_TIERS)[number]

/**
 * Tiers offered for new purchases — yalnız Servis Paketi (#782). `lite`,
 * `starter` ve `premium` eski/elle verilen satırlar için okunur kalır.
 */
export const SALE_PLAN_TIERS = ["pro"] as const
export type SalePlanTier = (typeof SALE_PLAN_TIERS)[number]

export function isPlanTier(value: unknown): value is PlanTier {
  return typeof value === "string" && PLAN_TIERS.some((tier) => tier === value)
}

export function isSalePlanTier(value: unknown): value is SalePlanTier {
  return typeof value === "string" && SALE_PLAN_TIERS.some((tier) => tier === value)
}

// Included login seats per plan tier. getPlanState resolves active trials to
// TRIAL_ACCESS_TIER, regardless of the stored sales/default tier.
export const PLAN_SEATS: Record<PlanTier, number> = {
  lite: 1,
  starter: 1,
  pro: 5,
  premium: 15,
}

/**
 * Per-tier monthly VIN/katalog kotası (atölye başına). Ek kota Workshop.extraVinQuota ile eklenir.
 * Şaseden parça (VIN + parça kataloğu) Servis Paketi'ne dahil olmayan bir ek
 * özellik olduğu için `pro` kotası 0'dır (#782).
 */
export const VIN_LOOKUP_QUOTA: Record<PlanTier, number> = {
  lite: 0,
  starter: 1_000,
  pro: 0,
  premium: 15_000,
}

/** Effective seat limit = tier-included seats + founder-granted extra seats. */
export function getSeatLimit(tier: PlanTier, extraSeats: number = 0): number {
  return PLAN_SEATS[tier] + Math.max(0, extraSeats)
}

/** Pakete göre okunur ad — hata metinlerinde "starter" değil "Başlangıç" geçsin. */
export const PLAN_LABELS: Record<PlanTier, string> = {
  lite: "Lite (eski)",
  starter: "Başlangıç (eski)",
  pro: "Servis Paketi",
  premium: "Paket + ek özellikler",
}

/**
 * Koltuk limiti dolduğunda kullanıcının GÖRDÜĞÜ cümle (BAK-37).
 *
 * Eski `lite`/`starter` satırlarının koltuk limiti 1'dir — o atölye HİÇ alt
 * kullanıcı açamaz ve ekip paneline her girişinde bu duvara toslar. Sessiz bir
 * "işlem başarısız" burada kabul edilemez: metin kaç/kaç olduğunu, neden
 * olduğunu ve çıkışı söylemek zorunda. Servis Paketi 5 kullanıcı içerir; fazlası
 * satılmıyor, iletişimle açılıyor (#782).
 *
 * Saf fonksiyon — hem sunucu kapısı (`assertSeatAvailableTx`) hem ekip paneli
 * aynı cümleyi kullanır, ikisi ayrışmasın.
 */
export function seatLimitMessage(tier: PlanTier, used: number, limit: number): string {
  const counts = `(${used}/${limit})`
  if (limit <= 1) {
    return (
      `Koltuk limitiniz dolu ${counts}. ${PLAN_LABELS[tier]} paketi tek kullanıcı içerir — ` +
      `ekibinize kullanıcı eklemek için ${PLAN_SEATS.pro} kullanıcılı ${PLAN_LABELS.pro}'ne geçmeniz gerekiyor.`
    )
  }
  return (
    `Koltuk limitiniz dolu ${counts}. Ek kullanıcı için bizimle iletişime geçin.`
  )
}

export type LockReason =
  | "pending"
  | "rejected"
  | "trial_expired"
  | "subscription_inactive"
  | "subscription_expired"
  | null

/**
 * Lock reasons that mean "the workshop has to pay to continue" — as opposed to
 * the approval gate (`pending`/`rejected`), which is recovered by verifying a
 * e-mail or contacting support. These three are enforced as a hard paywall:
 * (app)/layout.tsx signs the session out (GET /api/auth/logout) and the next
 * login is redirected to /checkout instead of /dashboard.
 */
export const PLAN_EXPIRED_LOCK_REASONS = [
  "trial_expired",
  "subscription_expired",
  "subscription_inactive",
] as const

export type PlanExpiredLockReason = (typeof PLAN_EXPIRED_LOCK_REASONS)[number]

export function isPlanExpiredLock(
  reason: LockReason | string | null | undefined
): reason is PlanExpiredLockReason {
  return PLAN_EXPIRED_LOCK_REASONS.includes(reason as PlanExpiredLockReason)
}

export type GatedFeature =
  | "ocrIntake"
  | "plateScan"
  | "photoChecklist"
  | "damageMap"
  | "eInvoice"
  | "multiBranch"
  | "rbac"
  | "vinLookup"
  | "partsCatalog"
  | "bakimxCatalog"
  | "getirbakimCatalog"
  | "quotes"
  | "appointments"
  | "automatedReminders"
  | "team"
  | "partsInventory"
  | "procurement"
  | "cashbox"
  | "analytics"
  | "reports"
  | "communications"
  | "vehiclePassport"

export const GATED_FEATURES: readonly GatedFeature[] = [
  "ocrIntake", "plateScan", "photoChecklist", "damageMap", "eInvoice", "multiBranch", "rbac",
  "vinLookup", "partsCatalog", "bakimxCatalog", "getirbakimCatalog", "quotes",
  "appointments", "automatedReminders", "team", "partsInventory", "procurement",
  "cashbox", "analytics", "reports", "communications", "vehiclePassport",
] as const

/**
 * Pakete dahil olmayan, ileride uygulama içinden ayrıca satılacak yetenekler
 * (#782): şaseden parça (`vinLookup` + `partsCatalog`), ruhsat OCR, e-Fatura ve
 * çoklu şube. AI danışmanının kodda kapısı yok; yalnız katalogda listelenir.
 * Plaka okuma (`plateScan`) pakete DAHİLDİR, burada yer almaz.
 */
export const ADDON_FEATURES = [
  "vinLookup",
  "partsCatalog",
  "ocrIntake",
  "eInvoice",
  "multiBranch",
] as const satisfies readonly GatedFeature[]
export type AddonFeature = (typeof ADDON_FEATURES)[number]

export function isAddonFeature(feature: GatedFeature): feature is AddonFeature {
  return ADDON_FEATURES.some((addon) => addon === feature)
}

/**
 * Deneme süresince ek özellikler de açık mı? Tek karar noktası: `false`
 * yapılırsa deneme yalnız Servis Paketi haklarıyla çalışır (#782).
 */
export const TRIAL_INCLUDES_ADDONS = true

/** Aktif denemenin çözüldüğü erişim profili. */
export const TRIAL_ACCESS_TIER: PlanTier = TRIAL_INCLUDES_ADDONS ? "premium" : "pro"

/**
 * Lowest purchasable/legacy tier which owns a capability. Add-on'lar bugün
 * yalnız `premium` erişim profiliyle (deneme / elle verilen) açılır.
 */
export const FEATURE_MIN_TIER: Record<GatedFeature, PlanTier> = {
  ocrIntake: "premium",
  plateScan: "starter",
  photoChecklist: "starter",
  damageMap: "starter",
  eInvoice: "premium",
  multiBranch: "premium",
  rbac: "pro",
  vinLookup: "premium",
  partsCatalog: "premium",
  bakimxCatalog: "starter",
  getirbakimCatalog: "starter",
  quotes: "pro",
  appointments: "pro",
  automatedReminders: "pro",
  team: "pro",
  partsInventory: "pro",
  procurement: "pro",
  cashbox: "starter",
  analytics: "pro",
  reports: "pro",
  communications: "pro",
  vehiclePassport: "starter",
}

/**
 * Eski Başlangıç (`starter`) satırlarının hakları. Ruhsat OCR ve parça kataloğu
 * artık ek özellik olduğu için buradan çıktı; plaka okuma kaldığı yerden devam
 * eder (#782).
 */
const STARTER_FEATURES = new Set<GatedFeature>([
  "plateScan",
  "photoChecklist",
  "damageMap",
  "bakimxCatalog",
  "getirbakimCatalog",
  "cashbox",
  "vehiclePassport",
])

type WorkshopPlanFields = Pick<
  Workshop,
  "planTier" | "subscriptionStatus" | "approvalStatus" | "trialEndsAt" | "currentPeriodEnd"
> & { liteFreeGrantedAt?: Date | null }

export interface PlanState {
  /** Persisted billing tier. */
  tier: PlanTier
  /** Entitlement tier used by feature, seat and quota checks. Trials resolve to TRIAL_ACCESS_TIER. */
  accessTier: PlanTier
  isApproved: boolean
  isTrialing: boolean
  trialEndsAt: Date | null
  /** Remaining business days in the trial, or null when not trialing. */
  trialDaysLeft: number | null
  isTrialExpired: boolean
  /** Paid period end (active subs only), or null. */
  currentPeriodEnd: Date | null
  /** Whole days left in the paid period (ceil) when active+period set, else null. */
  subscriptionDaysLeft: number | null
  /** True when the workshop may use the app. */
  hasAccess: boolean
  /** Why access is blocked, or null when access is granted. */
  lockReason: LockReason
  /**
   * True when the workshop may perform data mutations — false whenever ANY
   * `lockReason` is set (i.e. `canWrite === hasAccess`). This is the
   * server-side enforcement (assertWriteAccess / requireWritableWorkshop);
   * PlanLocked / the read-only banner are only the UX layer on top. In
   * particular `pending` (e-mail not verified yet) and `rejected` MUST block
   * writes here too: those sessions can reach server actions / API routes
   * directly with their cookie, bypassing the full-screen lock HTML.
   */
  canWrite: boolean
}

export function getPlanState(workshop: WorkshopPlanFields): PlanState {
  const tier = workshop.planTier as PlanTier
  const lifetimeLite = hasLifetimeLite(workshop)
  const status = lifetimeLite ? "active" : workshop.subscriptionStatus
  const approval = workshop.approvalStatus
  const trialEndsAt = lifetimeLite ? null : workshop.trialEndsAt ?? null
  const currentPeriodEnd = lifetimeLite ? null : workshop.currentPeriodEnd ?? null

  const isApproved = approval === "approved"
  const isTrialing = status === "trialing"
  const now = Date.now()
  const isTrialExpired =
    isTrialing && trialEndsAt != null && now > trialEndsAt.getTime()

  const trialDaysLeft =
    isTrialing && trialEndsAt != null
      ? businessDaysUntil(new Date(now), trialEndsAt)
      : null

  const subscriptionDaysLeft =
    status === "active" && currentPeriodEnd != null
      ? Math.max(0, Math.ceil((currentPeriodEnd.getTime() - now) / DAY_MS))
      : null

  let hasAccess = false
  let lockReason: LockReason = null

  if (!isApproved) {
    lockReason = approval === "rejected" ? "rejected" : "pending"
  } else if (status === "active") {
    if (currentPeriodEnd != null && now > currentPeriodEnd.getTime()) {
      lockReason = "subscription_expired"
    } else {
      hasAccess = true
    }
  } else if (status === "trialing") {
    if (isTrialExpired) lockReason = "trial_expired"
    else hasAccess = true
  } else {
    // past_due | canceled
    lockReason = "subscription_inactive"
  }

  // Write gate: ANY lock reason blocks mutations centrally (server actions /
  // API routes). pending/rejected included — see the PlanState.canWrite doc.
  const canWrite = hasAccess

  return {
    tier,
    accessTier: hasAccess && isTrialing ? TRIAL_ACCESS_TIER : tier,
    isApproved,
    isTrialing,
    trialEndsAt,
    trialDaysLeft,
    isTrialExpired,
    currentPeriodEnd,
    subscriptionDaysLeft,
    hasAccess,
    lockReason,
    canWrite,
  }
}

/**
 * Thrown by {@link assertWriteAccess} when a workshop may not mutate data
 * (pending/rejected approval gate or plan-expired read-only state). Carries the
 * `lockReason` so callers/API routes can map it to a stable machine code
 * (`plan_locked`) plus the user-facing message.
 */
export class PlanWriteLockedError extends Error {
  readonly lockReason: LockReason
  constructor(message: string, lockReason: LockReason) {
    super(message)
    this.name = "PlanWriteLockedError"
    this.lockReason = lockReason
  }
}

/**
 * Central write guard. Throws {@link PlanWriteLockedError} whenever the
 * workshop may not mutate data: e-mail verification not completed (`pending`),
 * suspended (`rejected`), or plan expired (read-only mode). Server
 * actions/routes that mutate tenant data should call this after auth. The
 * billing/purchase flow and auth actions are intentionally exempt so a locked
 * workshop can still pay/verify to recover.
 */
export function assertWriteAccess(workshop: WorkshopPlanFields): void {
  const { canWrite, lockReason } = getPlanState(workshop)
  if (canWrite) return
  let message: string
  switch (lockReason) {
    case "pending":
      message = "Hesabınız e-posta doğrulaması bekliyor. Devam etmek için e-posta adresinizi doğrulayın."
      break
    case "rejected":
      message = "Hesabınız askıya alınmış. Destek ile iletişime geçin."
      break
    case "trial_expired":
      message = "Deneme süreniz doldu. Devam etmek için bir paket satın alın."
      break
    default:
      message = "Aboneliğiniz sona erdi. Devam etmek için aboneliğinizi yenileyin."
  }
  throw new PlanWriteLockedError(message, lockReason)
}

/** Deneme bitişi: doğrulama anından sonraki yedinci İstanbul iş günü. */
export function computeTrialEnd(from: Date): Date {
  const result = new Date(from)
  let added = 0
  while (added < TRIAL_BUSINESS_DAYS) {
    result.setUTCDate(result.getUTCDate() + 1)
    if (isBusinessDay(result)) added += 1
  }
  return result
}

export function hasFeature(tier: PlanTier, feature: GatedFeature): boolean {
  // `premium` = "Paket + ek özellikler" erişim profili (deneme / elle verilen).
  if (tier === "premium") return true
  // Ek özellikler pakete dahil değil — ayrı satın alma akışı gelene kadar kapalı.
  if (isAddonFeature(feature)) return false
  if (tier === "pro") return true
  if (tier === "starter") return STARTER_FEATURES.has(feature)
  return false
}

export function hasWorkshopFeature(
  workshop: WorkshopPlanFields,
  feature: GatedFeature
): boolean {
  return hasFeature(getPlanState(workshop).accessTier, feature)
}

export function getEffectiveSeatLimit(
  workshop: WorkshopPlanFields & { extraSeats?: number | null }
): number {
  return getSeatLimit(getPlanState(workshop).accessTier, workshop.extraSeats ?? 0)
}

/** Ek özellik kilidinde gösterilen metin — satın alma akışı henüz yok (#782). */
export const ADDON_LOCKED_MESSAGE =
  "Bu özellik pakete dahil değildir; ek özellik olarak yakında satın alınabilecek. Bilgi için bizimle iletişime geçin."

/** Pakette olan ama eski (Lite/Başlangıç) satırda kapalı özelliğin metni. */
export const PACKAGE_FEATURE_LOCKED_MESSAGE = "Bu özellik paketinizde bulunmuyor."

/** API route'larının 403 `feature_locked` gövdesindeki tek kaynak metin. */
export function featureLockedMessage(feature: GatedFeature): string {
  return isAddonFeature(feature) ? ADDON_LOCKED_MESSAGE : PACKAGE_FEATURE_LOCKED_MESSAGE
}

export class PlanFeatureLockedError extends Error {
  // İstemciler (api-errors.ts, vin-resolve.tsx, vin-link-prompt.tsx) bu koda bakar — sabit kalır.
  readonly code = "feature_locked"
  readonly feature: GatedFeature
  readonly requiredTier: PlanTier
  /** True when the feature is a not-yet-purchasable add-on rather than a package feature. */
  readonly addon: boolean

  constructor(feature: GatedFeature) {
    super(featureLockedMessage(feature))
    this.name = "PlanFeatureLockedError"
    this.feature = feature
    this.requiredTier = FEATURE_MIN_TIER[feature]
    this.addon = isAddonFeature(feature)
  }
}

/**
 * Throws if the workshop's tier does not include the feature. Adopt inside
 * server actions as premium features ship (API routes should prefer the
 * `hasFeature`-based 403 pattern instead of throwing).
 */
export function assertFeature(
  workshop: WorkshopPlanFields,
  feature: GatedFeature
): void {
  if (!hasWorkshopFeature(workshop, feature)) throw new PlanFeatureLockedError(feature)
}

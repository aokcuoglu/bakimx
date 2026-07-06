import type { Workshop } from "@prisma/client"

/**
 * Plan / subscription / trial logic for the SaaS access model.
 *
 * Two orthogonal gates exist:
 *  - approvalStatus: legacy kill-switch gate. Self sign-ups (register + public
 *    checkout) are approved instantly and start their trial immediately —
 *    admin approval is no longer required to gain access. The gate still
 *    exists so an admin can `rejectWorkshop` (suspend) an account, and for any
 *    older rows still sitting in `pending` from before this change.
 *  - subscriptionStatus + trialEndsAt: billing/trial lifecycle
 *
 * Today only the ACCESS gate (`hasAccess`) is enforced (login + /app layout).
 *
 * Per-feature gating:
 *  - `aiAdvisor`: WIRED via `hasFeature` in the `/api/advisor` and
 *    `/api/orders/advisor` API routes (return 403 + feature_locked). The UI
 *    conditionally renders the panel/`AdvisorPremiumLock` CTA based on
 *    `hasFeature(workshop.planTier, "aiAdvisor")`.
 *  - `assertFeature` (throw-based) is ready to adopt inside server actions as
 *    further premium features ship.
 *  - `eInvoice`: planned gate on e-Fatura issuance when the integration lands
 *    (work-order completion flow).
 *  - `multiBranch`: planned gate on branch creation (`/app/branches`).
 *  - `rbac`: defined for completeness; today RBAC roles (owner/manager/staff)
 *    are available across all tiers, so the gate is informational only.
 */

export const TRIAL_DAYS = 7
const DAY_MS = 86_400_000

export type PlanTier = "starter" | "pro" | "premium"

// Included login seats per plan tier. During the trial a workshop is on `pro`,
// so it gets pro's seat allowance. Extra seats are granted per-workshop on top.
export const PLAN_SEATS: Record<PlanTier, number> = {
  starter: 1,
  pro: 5,
  premium: 15,
}

/** Effective seat limit = tier-included seats + founder-granted extra seats. */
export function getSeatLimit(tier: PlanTier, extraSeats: number = 0): number {
  return PLAN_SEATS[tier] + Math.max(0, extraSeats)
}

export type LockReason =
  | "pending"
  | "rejected"
  | "trial_expired"
  | "subscription_inactive"
  | "subscription_expired"
  | null

const TIER_RANK: Record<PlanTier, number> = { starter: 1, pro: 2, premium: 3 }

// Gated capabilities. Used by assertFeature() as these features come online.
// During the trial a workshop is on the `pro` tier, so premium features remain
// locked behind an upgrade. `starter` min tier = enabled for every plan (the
// gate then only serves as a per-tenant kill switch via feature overrides).
export type GatedFeature = "eInvoice" | "aiAdvisor" | "multiBranch" | "rbac" | "vinLookup" | "partsCatalog"
const FEATURE_MIN_TIER: Record<GatedFeature, PlanTier> = {
  eInvoice: "premium",
  aiAdvisor: "premium",
  multiBranch: "premium",
  rbac: "premium",
  vinLookup: "starter",
  partsCatalog: "starter",
}

type WorkshopPlanFields = Pick<
  Workshop,
  "planTier" | "subscriptionStatus" | "approvalStatus" | "trialEndsAt" | "currentPeriodEnd"
>

export interface PlanState {
  tier: PlanTier
  isApproved: boolean
  isTrialing: boolean
  trialEndsAt: Date | null
  /** Whole days left in the trial (ceil), or null when not trialing. */
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
   * True when the workshop may perform data mutations. False only for the
   * read-only lock reasons (`trial_expired | subscription_expired |
   * subscription_inactive`), where data stays visible but writes are blocked
   * centrally. `pending`/`rejected` are full-screen locked elsewhere, so
   * `canWrite` is left `true` for them on purpose — it must never become a
   * second, confusing gate for accounts that already see PlanLocked.
   */
  canWrite: boolean
}

export function getPlanState(workshop: WorkshopPlanFields): PlanState {
  const tier = workshop.planTier as PlanTier
  const status = workshop.subscriptionStatus
  const approval = workshop.approvalStatus
  const trialEndsAt = workshop.trialEndsAt ?? null
  const currentPeriodEnd = workshop.currentPeriodEnd ?? null

  const isApproved = approval === "approved"
  const isTrialing = status === "trialing"
  const now = Date.now()
  const isTrialExpired =
    isTrialing && trialEndsAt != null && now > trialEndsAt.getTime()

  const trialDaysLeft =
    isTrialing && trialEndsAt != null
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / DAY_MS))
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

  // Read-only lock: data remains visible but mutations are blocked centrally.
  // Only the expiry lock reasons flip this; pending/rejected keep canWrite=true
  // (they are full-screen locked separately — see the PlanState.canWrite doc).
  const canWrite =
    lockReason !== "trial_expired" &&
    lockReason !== "subscription_expired" &&
    lockReason !== "subscription_inactive"

  return {
    tier,
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
 * Thrown by {@link assertWriteAccess} when a workshop is in the read-only
 * (plan-expired) state. Carries the `lockReason` so callers/API routes can map
 * it to a stable machine code (`plan_locked`) plus the user-facing message.
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
 * Central write guard. Throws {@link PlanWriteLockedError} when the workshop's
 * plan has expired (read-only mode). Server actions/routes that mutate tenant
 * data should call this after auth. The billing/purchase flow and auth actions
 * are intentionally exempt so a locked workshop can still pay to recover.
 */
export function assertWriteAccess(workshop: WorkshopPlanFields): void {
  const { canWrite, lockReason } = getPlanState(workshop)
  if (canWrite) return
  const message =
    lockReason === "trial_expired"
      ? "Deneme süreniz doldu. Devam etmek için bir paket satın alın."
      : "Aboneliğiniz sona erdi. Devam etmek için aboneliğinizi yenileyin."
  throw new PlanWriteLockedError(message, lockReason)
}

/** Trial end timestamp computed from a start date (used when a workshop is approved). */
export function computeTrialEnd(from: Date): Date {
  return new Date(from.getTime() + TRIAL_DAYS * DAY_MS)
}

export function hasFeature(tier: PlanTier, feature: GatedFeature): boolean {
  return TIER_RANK[tier] >= TIER_RANK[FEATURE_MIN_TIER[feature]]
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
  if (!hasFeature(workshop.planTier as PlanTier, feature)) {
    throw new Error(
      "Bu özellik mevcut paketinizde bulunmuyor. Yükseltmek için bizimle iletişime geçin."
    )
  }
}

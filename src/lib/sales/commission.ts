import type {
  BillingCycle,
  BillingOrderType,
  PlanTier as PrismaPlanTier,
  Prisma,
  SalesCommissionStatus,
} from "@prisma/client"
import { isPlanTier, PLAN_TIERS, type PlanTier } from "@/lib/plan"

export type CommissionActor = {
  userId?: string | null
  label: string
}

export type CommissionOrderSnapshot = {
  id: string
  workshopId: string
  type: BillingOrderType
  planTier: PrismaPlanTier
  previousPlanTier: PrismaPlanTier | null
  billingCycle: BillingCycle
  createdAt: Date
  netAmountMinor: number
}

export type CommissionDraftResult =
  | { created: true; commissionId: string; reviewReason: "missing_rule" | null }
  | { created: false; reason: "already_exists" | "not_attributed" | "not_eligible" }

/** Net tahsilat × oran; tüm girdiler tam sayı ve sonuç tam kuruşa yuvarlanır. */
export function calculateCommissionAmountMinor(baseMinor: number, rateBps: number): number {
  if (!Number.isSafeInteger(baseMinor) || baseMinor < 0) {
    throw new Error("Hakediş bazı negatif olmayan tam sayı kuruş olmalıdır.")
  }
  if (!Number.isSafeInteger(rateBps) || rateBps < 0 || rateBps > 10_000) {
    throw new Error("Hakediş oranı 0-10000 baz puan arasında olmalıdır.")
  }
  const roundedAmount = (
    BigInt(baseMinor) * BigInt(rateBps) + BigInt(5_000)
  ) / BigInt(10_000)
  const amountMinor = Number(roundedAmount)
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error("Hakediş tutarı güvenli tam sayı sınırını aşıyor.")
  }
  return amountMinor
}

function tierRank(tier: string | null): number | null {
  return isPlanTier(tier) ? PLAN_TIERS.indexOf(tier as PlanTier) : null
}

/** Yalnız ilk satış ve hedef paketi gerçekten daha yüksek olan geçiş uygundur. */
export function isCommissionEligible(input: {
  type: BillingOrderType
  previousPlanTier: string | null
  targetPlanTier: string
}): boolean {
  if (input.type === "new_purchase") return true
  if (input.type !== "upgrade") return false
  const previousRank = tierRank(input.previousPlanTier)
  const targetRank = tierRank(input.targetPlanTier)
  return previousRank != null && targetRank != null && targetRank > previousRank
}

const TRANSITIONS: Record<SalesCommissionStatus, readonly SalesCommissionStatus[]> = {
  draft: ["approved", "void"],
  approved: ["paid", "void"],
  paid: [],
  void: [],
}

export function canTransitionSalesCommission(
  from: SalesCommissionStatus,
  to: SalesCommissionStatus,
): boolean {
  return TRANSITIONS[from].includes(to)
}

/** Hesaplanan tutardan sapma veya kural-eksik manuel tutar gerekçesiz onaylanamaz. */
export function commissionApprovalError(input: {
  calculatedAmountMinor: number | null
  approvedAmountMinor: number
  adjustmentReason: string
}): string | null {
  const isAdjustment =
    input.calculatedAmountMinor == null ||
    input.approvedAmountMinor !== input.calculatedAmountMinor
  if (isAdjustment && input.adjustmentReason.trim().length < 3) {
    return "Hesaplanan tutardan farklı bir onay için düzeltme gerekçesi zorunludur."
  }
  return null
}

/**
 * Ödeme aktivasyon transaction'ı içinde, sipariş başına en fazla bir ledger
 * taslağı açar. Kural yokluğu ödeme akışını durdurmaz; missing_rule inceleme
 * satırı üretir. Oran/baz/tutar sipariş createdAt anına göre snapshot edilir.
 */
export async function createCommissionDraftForBillingOrderTx(
  tx: Prisma.TransactionClient,
  order: CommissionOrderSnapshot,
  fallbackPreviousPlanTier: PrismaPlanTier | null,
  actor: CommissionActor,
): Promise<CommissionDraftResult> {
  const existing = await tx.salesCommission.findUnique({
    where: { billingOrderId: order.id },
    select: { id: true },
  })
  if (existing) return { created: false, reason: "already_exists" }

  if (!isCommissionEligible({
    type: order.type,
    previousPlanTier: order.previousPlanTier ?? fallbackPreviousPlanTier,
    targetPlanTier: order.planTier,
  })) {
    return { created: false, reason: "not_eligible" }
  }

  const lead = await tx.salesLead.findUnique({
    where: { workshopId: order.workshopId },
    select: { id: true, advisorId: true },
  })
  if (!lead?.advisorId) return { created: false, reason: "not_attributed" }

  const rule = await tx.salesCommissionRule.findFirst({
    where: {
      planTier: order.planTier,
      billingCycle: order.billingCycle,
      effectiveFrom: { lte: order.createdAt },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: order.createdAt } }],
    },
    orderBy: { effectiveFrom: "desc" },
    select: { id: true, rateBps: true },
  })
  const calculatedAmountMinor = rule
    ? calculateCommissionAmountMinor(order.netAmountMinor, rule.rateBps)
    : null

  const commission = await tx.salesCommission.create({
    data: {
      billingOrderId: order.id,
      leadId: lead.id,
      advisorId: lead.advisorId,
      ruleId: rule?.id ?? null,
      calculationBaseMinor: order.netAmountMinor,
      calculationRateBps: rule?.rateBps ?? null,
      calculatedAmountMinor,
      reviewReason: rule ? null : "missing_rule",
      events: {
        create: {
          fromStatus: null,
          toStatus: "draft",
          actorId: actor.userId ?? null,
          actorLabel: actor.label,
          amountMinor: calculatedAmountMinor,
          reason: rule
            ? "Hakediş sipariş tarihindeki kuralla hesaplandı."
            : "Sipariş tarihinde geçerli hakediş kuralı bulunamadı.",
        },
      },
    },
    select: { id: true },
  })

  return {
    created: true,
    commissionId: commission.id,
    reviewReason: rule ? null : "missing_rule",
  }
}
